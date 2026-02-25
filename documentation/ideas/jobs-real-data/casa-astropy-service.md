# CASA + Astropy Microservice Plan

Status date: 2026-02-22

The goal of this document is to sketch the design for a dedicated
microservice that performs the actual astronomical image creation for the
`astronomy`/`CASA` job mode. We already have a working queue/adapter
architecture; the service will act as the worker component, consuming jobs
from Redis, running CASA (and any ancillary Python processing with
astropy), and updating job state.

This service is embodied by a separate Docker container that can be run
inside the existing `docker-compose.astronomy.yml` profile or independently
in CI. The container is based on the same CASA image used elsewhere but
adds a lightweight HTTP server (FastAPI) and Python dependencies (astropy,
numpy, etc.).

## Why a microservice?

- **Decoupling**: orchestration (Nest/Node) is separate from compute (CASA);
  the API only queues jobs and polls state.
- **Reusability**: the container can be built once and used locally, in CI,
  or on another host without pulling the entire API image.
- **Testability**: we can write HTTP contract tests for the service without
  booting the full Nest application.
- **Extensibility**: future enhancements (e.g. GPU scheduling, remote
  Slurm submission, alternate processing pipelines) can live inside the
  service without touching the API code.

If the number of moving parts is a concern, the alternative is to embed the
service logic directly in the existing Node worker process. That would
avoid adding a new container, but it would entangle Node with CASA's
Python ecosystem and make it harder to reproduce the compute environment in
CI. The microservice approach trades a little orchestration complexity for
cleaner boundaries and a more robust build/test pipeline.

## High-level architecture

```text
Client/UI
   ↕
Nest API / Adapter (enqueues job)  ←→  Redis queue/hash
                                    ↕
                         CASA-Astropy microservice
                             (FastAPI + CASA base image)
                                    ↕
                              Docker/CASA runtime
                                    ↕
                              `/data` volume (MS + results)
```

Endpoints exposed by the microservice:

- `POST /jobs` – accept a job submission; return `jobId`.
- `GET /jobs/{id}/status` – return current state/progress/error/output_url.
- `POST /jobs/{id}/cancel` – mark job canceled and stop any running
  CASA process.
- `GET /health` – liveness probe for Kubernetes/compose.

Internally the service also consumes from `casa:queue` and performs the
same state updates as the current `worker.ts` script; the HTTP layer is a
convenience for direct testing and eventual alternative clients. The
existing Node worker may be replaced entirely by the service or may simply
remain as an alternate consumer (depending on deployment preference).

## Container design

- **Base image**: `casapy/casa:latest` or a pinned version.
- **Extras**:
  - `pip install astropy numpy fastapi uvicorn[standard]`
  - copy `run-image.py` (or a richer Python pipeline) into `/opt`.
  - add `/app/service.py` housing the FastAPI server and job logic.
- **Entrypoint**: `uvicorn service:app --host 0.0.0.0 --port 8080`.
- **Volumes**: mount `/data` for datasets and outputs.
- **Environment**:
  - `REDIS_URL` – connection string for job queue.
  - `ASTRO_DATA_DIR` – path inside container (defaults to `/data`).
  - optional `CASA_QUEUE_LIMIT` for internal throttling.

A `Dockerfile` will live next to the one we already created for the
worker; the CI will build it and tag it `astronomy-worker:latest`.

## Implementation plan

1. Create new `apps/cosmic-horizons-api/docker/astro-service.Dockerfile`
   based on the sketch above.
2. Write `apps/cosmic-horizons-api/src/app/jobs/astro-service.py` (FastAPI
   application) that implements the endpoints and the queue consumer.
3. Update `docker-compose.astronomy.yml` to include the new service and
   remove or optionally keep the existing Node `cosmic-horizons-worker`.
4. Adapt `worker.ts` or retire it in favour of the Python service. For now
   both can coexist, with the Python service being the preferred path.
5. Add e2e tests:
   - HTTP client tests against the service container (`pnpm nx test …` or a
     separate Pytest suite).
   - CI workflow step that builds the service image, brings up compose
     profile, submits a job via the Nest API, waits on `/jobs/{id}/status`,
     and verifies a FITS file appears. Use `SIMULATE_CASA` flag to run a
     quick variant when Docker is slow.
6. Populate the service’s `run-image.py` with a simple CASA script that
   actually invokes `tclean` or equivalent on `/data/sample.ms`. Use
   astropy inside the service for any metadata extraction or FITS post‑proc.
7. Document the service in architecture docs and add environment variables
   to `ENV-REFERENCE.md` (e.g. `ASTRO_SERVICE_URL`).

## Roadmap updates

The Phase 3 TODO will be updated to reflect this new microservice task:

- [ ] Create CASA‑Astropy microservice container with FastAPI.
- [ ] Replace Node worker with HTTP call or retire Node worker.
- [ ] Add CI workflow to exercise full compose profile including service.

## Summary

A dedicated FastAPI microservice built on the CASA base image offers a
clean, testable, and extensible way to run real astronomical imaging as
part of the `astronomy` job mode. It fits naturally inside the existing
Docker profile, and only one extra container is required. The service
will strike a balance between minimal extra moving parts and architectural
clarity; it can later be scaled, monitored, or swapped for a remote
compute backend without touching the Nest API.

The next step is to prototype the Dockerfile + FastAPI skeleton and wire
it into CI; once that’s solid we can replace the placeholder Python
script with actual CASA/WSClean commands and astropy processing.
