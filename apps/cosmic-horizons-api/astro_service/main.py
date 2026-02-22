import os
import time
import json
import threading
from typing import Optional, AsyncGenerator, Any
from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DATA_DIR = os.getenv("ASTRO_DATA_DIR", "/data")
QUEUE_NAME = os.getenv("CASA_QUEUE_NAME", "casa:queue")

# create typed Redis client for Pylance
r: redis.Redis = redis.from_url(REDIS_URL, decode_responses=True)

# use a lifespan event handler rather than the deprecated @app.on_event (import
# already performed at the top)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    thread = threading.Thread(target=worker_loop, daemon=True)
    thread.start()
    yield


app = FastAPI(title="CASA Astropy Service", lifespan=lifespan)


class JobSubmission(BaseModel):
    agent: str
    dataset_id: str
    params: Optional[dict[str, Any]] = {}


@app.post("/jobs")
def create_job(sub: JobSubmission) -> dict[str, str]:
    job_id = f"casa-{int(time.time()*1000)}-{os.urandom(3).hex()}"
    key = f"casa:job:{job_id}"
    r.hset(
        key,
        mapping={
            "status": "QUEUED",
            "createdAt": str(int(time.time())),
            "agent": sub.agent,
            "dataset_id": sub.dataset_id,
            "params": json.dumps(sub.params or {}),
        },
    )
    r.lpush(QUEUE_NAME, job_id)
    return {"jobId": job_id}


@app.get("/jobs/{job_id}/status")
def get_status(job_id: str) -> dict[str, Any]:
    key = f"casa:job:{job_id}"
    # hgetall returns a dict of strings; pylance sometimes reports Awaitable
    from typing import cast

    raw = r.hgetall(key)
    data = cast(dict[str, str], raw)
    if not data:
        raise HTTPException(status_code=404, detail="job not found")
    return {
        "id": job_id,
        "status": data.get("status", "UNKNOWN"),
        "progress": float(data.get("progress", 0)),
        "output_url": data.get("output_url"),
        "error": data.get("error"),
    }


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict[str, bool]:
    key = f"casa:job:{job_id}"
    if not r.exists(key):
        raise HTTPException(status_code=404, detail="job not found")
    r.hset(key, "status", "CANCELED")
    return {"success": True}


@app.get("/health")
def health() -> dict[str, str]:
    try:
        r.ping()
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="redis unreachable")


# worker loop


def worker_loop() -> None:
    print(f"astro-service worker started, connecting to {REDIS_URL}")
    while True:
        # brpop expects a list of keys
        res = r.brpop([QUEUE_NAME], timeout=0)
        if not res:
            continue
        # res is a tuple (key, value)
        job_id = res[1]  # type: ignore[index]
        print(f"processing job {job_id}")
        key = f"casa:job:{job_id}"
        try:
            # mark running
            r.hset(key, "status", "RUNNING")
            # for now call external script if exists
            script = os.path.join(DATA_DIR, "run-image.py")
            if os.path.exists(script):
                os.system(f"python {script}")
            # mark completed
            r.hset(
                key,
                mapping={
                    "status": "COMPLETED",
                    "progress": "1",
                    "output_url": f"/files/{job_id}.fits",
                },
            )
        except Exception as e:
            r.hset(key, mapping={"status": "FAILED", "error": str(e)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
