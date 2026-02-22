# Backend Adapter Design & Implementation

The `jobs` feature already uses an adapter pattern to hide the details of the
external compute service.  The existing adapters are:

* `DemoTaccAdapter` – simple in‑process simulator that returns canned
  responses and is used by default (demo mode).
* `LocalLlmAdapter` – wraps a local LLM (Ollama) to generate realistic
  status messages without needing any external credentials.

To integrate real astronomy software we will introduce a third adapter,
`CasaAdapter`, which invokes Docker containers running CASA/WSClean on
actual measurement sets.  The adapter interface is defined in
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
  * copy the appropriate MS into a working directory (already mounted via
    docker volume).
  * generate a small CASA Python script based on job parameters.
  * execute: `docker exec cosmic-horizons-casa casa --nogui -c '/tmp/script.py'`.
  * immediately return a `jobId` (prefix with `casa-` and timestamp).
  * record the script path and expected output filename in an in‑memory map or
    Redis cache so `status()` can look them up.

* **status**
  * check whether `/data/<jobId>.fits` exists; if not, return `{ status: 'RUNNING', progress: 50 }`.
  * when the file appears, return `{ status: 'COMPLETED', progress: 100, output_url: '/files/<jobId>.fits' }`.

* **result**
  * simply return the persistent URL/relative path the frontend can fetch to
    download the FITS.

* **cancel** (optional) – remove the container process or kill CASA if still running.

The adapter may also emit events (via `EventEmitter`) that the API service
listens to and converts into Kafka/RabbitMQ messages used by the rest of the
system; this matches what the `DemoTaccAdapter` already does for simulated
jobs.

### Configuration switch

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
