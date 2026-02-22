# Backend Adapter Design & Implementation

The `jobs` feature already uses an adapter pattern to hide the details of the
external compute service.  The existing adapters are:

* `DemoTaccAdapter` – simple in‑process simulator that returns canned
  responses and is used by default (demo mode).
* `LocalLlmAdapter` – wraps a local LLM (Ollama) to generate realistic
  status messages without needing any external credentials.

To integrate real astronomy software we will introduce a third adapter,
`CasaAdapter`, but unlike the demo and LLM adapters it will **not execute
CASA synchronously**.  Instead it will enqueue the job for asynchronous
processing by a worker container, turning the API into a lightweight gateway
that can scale and survive restarts.  The adapter interface is defined in
`apps/cosmic-horizons-api/src/app/jobs/tacc.integration.adapter.ts` and looks like:

```ts
export interface TaccAdapter {
  submit(params: JobSubmitParams): Promise<{ jobId: string }>;
  status(jobId: string): Promise<JobStatus>;
  result(jobId: string): Promise<JobResult>;
  cancel?(jobId: string): Promise<void>;
}
```

## CASA adapter behaviour

* **submit**
  * persist the job parameters and dataset metadata into a durable store
    (Redis hash or MongoDB document).  Include a `status: 'queued'` field and
    a `createdAt` timestamp.  For auditability also mirror key fields into the
    PostgreSQL `jobs` table so the job history survives Redis flushes and can
    be queried by the retention service.
  * enqueue a job ID onto a Redis/RabbitMQ/Kafka queue that a pool of worker
    containers will consume.  At this point the API call returns a `jobId`
    immediately – the job has been accepted but not yet executed.
  * the worker will later pull the job off the queue, perform the CASA run in
    an isolated container (`docker run --rm casapy/casa …`), and update the
    persistent record with progress and final status.
  * emit events (`job.queued`) via the EventsModule so other subsystems can
    react (metrics, notifications, etc.).
  * **failure & retry handling**
    * workers should implement an exponential backoff with jitter; after N
      failed attempts the job is moved to a `dead-letter` queue and its status
      set to `FAILED`.  The API can expose a `/jobs/retry` endpoint for
      manual re‑submission.
    * capture stdout/stderr in the job record and include it in the `error`
      field so the frontend can display meaningful messages.

* **status**
  * read the persistent record from Redis/Mongo and return its `status`,
    `progress`, and any `output_url` or `error` fields.  No in‑memory maps are
    used; nothing is lost when the API restarts.

* **status**
  * check whether `/data/<jobId>.fits` exists; if not, return `{ status: 'RUNNING', progress: 50 }`.
  * when the file appears, return `{ status: 'COMPLETED', progress: 100, output_url: '/files/<jobId>.fits' }`.

* **result**
  * simply return the persistent URL/relative path the frontend can fetch to
    download the FITS.

* **cancel** (optional) – mark the persistent record `status='canceled'`
  and, if a worker is currently processing the job, signal it to stop (via a
  side‑channel or by running the CASA container with a job-specific cgroup
  that can be killed).  Using `docker run --rm` makes cancellation easier than
  `docker exec`.

The adapter may also emit events (via `EventEmitter`) that the API service
listens to and converts into Kafka/RabbitMQ messages used by the rest of the
system; this matches what the `DemoTaccAdapter` already does for simulated
jobs.

### Worker scaling & robustness

* Use `BRPOPLPUSH` or Redis streams when multiple workers consume the same
  queue to prevent jobs from being lost if a worker dies mid‑process.
* Track `attempts` in the hash so a worker knows when to back off or give up.
* Emit Prometheus metrics (`jobs_submitted`, `jobs_completed`,
  `jobs_failed`, `queue_length`) and expose them on `/:metrics`.
* Consider a plugin point for custom schedulers (Slurm, Kubernetes, HPC
  batch system) instead of launching Docker directly.

### Configuration switch

* **status**
  * read the persistent record from Redis/Mongo and return its `status`,
    `progress`, and any `output_url` or `error` fields.  No in‑memory maps are
    used; nothing is lost when the API restarts.

* **status**
  * check whether `/data/<jobId>.fits` exists; if not, return `{ status: 'RUNNING', progress: 50 }`.
  * when the file appears, return `{ status: 'COMPLETED', progress: 100, output_url: '/files/<jobId>.fits' }`.

* **result**
  * simply return the persistent URL/relative path the frontend can fetch to
    download the FITS.

* **cancel** (optional) – mark the persistent record `status='canceled'`
  and, if a worker is currently processing the job, signal it to stop (via a
  side‑channel or by running the CASA container with a job-specific cgroup
  that can be killed).  Using `docker run --rm` makes cancellation easier than
  `docker exec`.

The adapter may also emit events (via `EventEmitter`) that the API service
listens to and converts into Kafka/RabbitMQ messages used by the rest of the
system; this matches what the `DemoTaccAdapter` already does for simulated
jobs.

### Configuration switch

The existing configuration logic simply chooses an adapter based on
`REMOTE_COMPUTE_MODE`.  We can retain that – the only difference is that the
`CasaAdapter` now returns quickly and relies on a **Redis queue + worker
dependency** being available.  Thus the `astronomy` mode should implicitly
require a running queue service and at least one worker container.  The same
comment applies to the offline/LLM adapters, so the configuration mechanism
remains clean and unchanged.

### Ngrx vs promises

For the frontend, nothing about this async queue architecture constrains how
retrieving job status is implemented.  Using NgRx to dispatch actions and
maintain store state is perfectly compatible with the gateway pattern; each
status poll can be triggered by an effect that dispatches a `loadJobStatus`
action and handles the promise returned by the HTTP client.  The store simply
holds the `jobs` slice and updates when the status response arrives.  In
other words, switching to NgRx does not conflict with the backend changes –
it's purely a client‑side pattern choice.

Existing code in `tacc-integration.service.ts` already chooses an adapter
based on an environment variable.  Add one more branch:

```ts
switch (mode) {
  case 'demo': return new DemoTaccAdapter(...);
  case 'local-llm': return new LocalLlmAdapter(...);
  case 'astronomy': return new CasaAdapter(...);
  default: throw new Error(`unknown mode ${mode}`);
}
```

You can keep `TACC_LIVE` around for legacy but it’s orthogonal to these modes.

### Testing the adapter

* Unit tests:
  * verify that `submit()` generates a valid script and calls `docker exec`
    (use `jest.mock('child_process')` to spy on `execFile`).
  * stub `fs.existsSync` to simulate file creation and ensure `status()` maps
    correctly to `JobStatus` values.

* Integration tests:
  * start the `ASTRO` compose profile in the test setup (`execSync('docker compose ... up -d')`).
  * run a minimal job through the real adapter and assert that a FITS file
    appears in `astronomy-data/` and that both `/jobs/status` and `/jobs/result`
    return sensible values.
  * tear down the compose profile at the end of the suite.

By reusing the same interface, all existing controllers and e2e specs remain
valid; only the internal implementation changes.
