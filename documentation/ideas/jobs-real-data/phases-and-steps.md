# Phases & Steps for Real‑Data Jobs Integration

This roadmap breaks the work into discrete phases so the team can gradually
realise the complete end‑to‑end demo within the current workspace.  It is not
prescriptive; phases may be reordered or skipped depending on how the idea
matures.

## Phase 1 – Preparation

1. **Dataset selection**
   * Pick one or two small publicly available MS files (e.g. a VLASS pointing
     or NVSS snapshot) and place them in `astronomy-data/` (Git LFS optional).
   * Alternatively, document curl/wget commands or provide a `scripts/fetch-demo-data.mjs`
     helper that downloads them automatically.
   * These sample files should be small enough to process on a fairly powerful
     dev workstation (our machines are i9/24‑core, 64 GB RAM, 10 GB GPU); larger
     LOFAR/ALMA sets can still work but will push the limits and take longer.

2. **Docker profile**
   * Add `docker/docker-compose.astronomy.yml` containing CASA/WSClean
     service definitions that mount `../astronomy-data:/data`.
   * Ensure the standard `start:infra` scripts accept an optional
     `ASTRO=true` flag to include this profile.

3. **Adapter stub**
   * Create a placeholder `CasaAdapter` implementing the same interface as
     `DemoTaccAdapter`.  For now it may just return a fixed `jobId` and
     hard‑coded `status="COMPLETED"` so the plumbing is exercised.
   * Update configuration logic in `tacc-integration.service.ts` to select
     this adapter when `REMOTE_COMPUTE_MODE === 'astronomy'`.

## Phase 2 – Metadata & LLM

1. **Metadata extraction**
   * Write a small function (shell, Node) that runs `casa -c "print(listobs('/data/sample.ms'))"`
     inside the CASA container and parses a handful of useful fields
     (source name, band, date).
   * Expose this information via a new service or pass it straight into the
     adapter prompt builder.

2. **Prompt enrichment**
   * Modify `local-llm.adapter.ts` (used in demo and LLM modes) so that its
     `buildPrompt()` includes the dataset metadata above.  This produces
     progress messages like “calibrating VLASS J1347+1217…” instead of the
     generic `demo-job` text.

## Phase 3 – Real processing (queued architecture)

Transition from the simple synchronous model to a proper compute gateway:

* **Phase 0 – Sandbox preparation** (inserted earlier)
  * Pull or build the CASA/WSClean container images (`docker pull casapy/casa:latest`) and verify they run on each developer’s hardware.
  * Document any GPU/driver requirements and provide a smoke‑test script (`docker run --rm casapy/casa --version`).

* **Phase 3.5 – Scheduling & throttling** (after implementing queuing)
  * Implement simple rate limits or a leaky‑bucket algorithm in the API or
    worker so that no more than `N` jobs run concurrently.  This can be
    controlled via a Redis semaphore or by integrating with an external
    scheduler (Slurm, Kubernetes job queue) in later phases.

* **CI test case improvements**
  * Add a test that kills the worker mid‑job and restarts it, verifying the
    job status transitions to `FAILED` or resumes correctly based on state.
  * Assert that queue length increments and decrements appropriately and that
    `/datasets/refresh` returns free‑space/last‑updated fields.
  * Include a cancellation flow: submit a job, immediately cancel it, and
    ensure the worker detects the status change and aborts the container.

1. **CASA script & worker**
   * Develop a minimal imaging script (`/tmp/run-image.py`) that performs a
     quick `tclean` on `/data/sample.ms` and writes output to `/data/out.fits`.
   * Implement a worker container image (`apps/cosmic-horizons-api/docker/worker.Dockerfile`)
     that runs a small Node process or Nest module which polls the Redis queue,
     pulls the job record, runs CASA via `docker run --rm casapy/casa …` and
     updates the status/progress fields in Redis/Mongo.
   * Ensure the queue service (Redis/Kafka/RabbitMQ) and worker are defined in
     `docker-compose.astronomy.yml` so they can be started alongside the main
     API.  This decouples job execution from the stateless API process.

2. **Adapter implementation**
   * Update `CasaAdapter.submit()` to store the job in Redis/Mongo and push the
     ID onto the queue instead of calling CASA directly.
   * Modify `CasaAdapter.status()` to look up the persistent job record rather
     than checking local files.
   * Add retry logic and error handling: if the worker reports a failure, the
     record should include an `error` message and `status='failed'`; the
     adapter can then surface this to the API consumer.

3. **CI test case**
   * Add a Jest/e2e test that starts the `ASTRO` compose profile, submits a job
     in astronomy mode, polls until `COMPLETED`, and asserts the FITS file
     exists and the job result endpoint returns a valid URL.
   * Call `scripts/fetch-demo-data.mjs` at the start of this test to ensure the
     dataset is present.

## Phase 4 – Frontend UX

1. **Sample selection UI**
   * Update `jobs-console.component` to show a dropdown or autocomplete field
     populated with available dataset identifiers (hard‑coded list or derived
     from `astronomy-data` directory contents).
   * The summary text (`scienceIntentSummary`) should mention the chosen
     dataset and, once the job completes, the location of the generated image.

2. **Optional automation**
   * Add an extra button (`Fetch latest data`) that triggers the same Node
     script used by CI to refresh the sample directory; show progress in a
     snackbar.

## Phase 5 – Scaling and polish

* Add support for multiple datasets and allow the system to pre‑download all
  of them and select the best match based on user criteria (e.g. RA/Dec).
* Consider throttling or caching policies to avoid repeated multi‑GB downloads
  during development.
* Document environment variables such as `ASTRO_DATA_DIR` and `ASTRO_MODE`.
* Add logging and error handling in the adapter to surface CASA runtime errors
  in the normal `/jobs` logs.

Each phase should be accompanied by updates to the tests, CI configuration,
and documentation so that the behaviour is reproducible and maintainable.
