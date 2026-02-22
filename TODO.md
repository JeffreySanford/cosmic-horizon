# TODO

Status date: 2026-02-22

Completed items have been moved to `documentation/planning/roadmap/COMPLETE-TODO.md`.

Canonical planning docs:

- `documentation/planning/roadmap/ROADMAP.md` (forward-looking roadmap)
- `documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md` (scope authority)
- `documentation/governance/SOURCE-OF-TRUTH.md` (doc governance)

This file is the active execution checklist and near-term operating journal.

## Active Priority (Now)

- **Real‑Data Jobs Integration (astronomy mode)**
  - Phase 1 – Preparation (completed)
    - [x] Select one or two small public MS files and make them available under `astronomy-data/` (or add `scripts/fetch-demo-data.mjs`).
    - [x] Add `docker-compose.astronomy.yml` with CASA/WSClean services; ensure `start:infra` supports an `ASTRO=true` flag.
    - [x] Create a `CasaAdapter` stub implementing the existing demo interface and gate it on `REMOTE_COMPUTE_MODE === 'astronomy'`.
  - Phase 2 – Metadata & LLM (completed)
    - [x] Write a helper that runs `casa -c "print(listobs('/data/sample.ms'))" inside the CASA container and parses useful fields.
    - [x] Enrich `local-llm` prompts (and demo text) with dataset metadata so jobs read like “calibrating VLASS J1347+1217…”.
  - Architectural drawings (ideas/jobs-real-data/architecture-diagram.md)
    - [x] Draft and finalise detailed reference architecture diagrams.

  - Phase 3 – Real processing (queued architecture)
    - [x] Sandbox prep: pull/build CASA & WSClean images, document GPU requirements, create smoke test script.
    - [x] Implement scheduling/throttling (enqueue, Redis semaphore or external scheduler) with simple rate limit.
    - [x] Add CI test that kills a running worker and verifies correct failure/resume behavior.
    - [x] Develop minimal CASA imaging script and worker container (Node/Nest) polling the queue.
    - [x] Define `CasaAdapter.submit()` to enqueue and `status()` to query persistent job records.
    - [x] Add CI job that spins up the `ASTRO` compose profile, submits a job, polls until completion, and checks FITS output (current test uses simulated CASA; real-compose variant pending).
    - [x] Build CASA‑Astropy FastAPI microservice container and add it to the `ASTRO` compose profile.
    - [x] Update or retire the Node worker to call the service via HTTP (code moved to `jobs/archived/worker.ts`).

  - Phase 4 – Frontend UX
    - [ ] Update jobs-console.component with dataset selector and display of chosen dataset in summary.
    - [ ] Add optional "Fetch latest data" button to refresh sample directory.
    - [ ] Show the last‑updated timestamp for the selected dataset alongside its name.

  - Phase 5 – Scaling & polish
    - [ ] Support multiple datasets with pre-download & selection logic.
    - [ ] Add throttling/caching policies to reduce repeated downloads.
    - [ ] Document `ASTRO_DATA_DIR`, `ASTRO_MODE`, and log CASA runtime errors correctly.

- Phase 0 items have been moved to `documentation/planning/roadmap/COMPLETE-TODO.md`.

## Deferred / Awaiting credentials

- **Remote Compute Gateway Sprint 2 (live connectivity)**
  - Replace simulated orchestration path with real TACC Slurm/Tapis adapter.  
  - Data staging realism features (progress, errors, packaging) in demo mode.  
  - Add secure credential/header handling and audit-safe redaction.  
  - Persist end-to-end job provenance chain (submission -> status -> viewer/explainable artifact).  
  - Add feature-flagged live-mode rollout plan with explicit env gating.  
  - Continue smaller offline tasks as listed previously (refactor, mocks, tests, outreach materials).
  - Reach out to UT/CosmicAI stakeholders to obtain credentials or a sandbox endpoint; track contact in planning notes.

- **Local LLM Orchestration completion (offline/local mode)** – these items remain important but can proceed opportunistically; none require external access.
  - (keep list of remaining bullets here, or simply reference earlier section for visibility)

## CI / Quality Follow-up

Completed items are archived in `documentation/planning/roadmap/COMPLETE-TODO.md`.

(See that file for details.)

## Documentation Alignment Tasks

- [ ] Keep `README.md`, `TODO.md`, and roadmap in sync after each execution wave.
- [ ] Continue trimming stale historical sections from legacy docs where roadmap/todo now carry canonical status.
- [ ] Maintain `documentation/NGRX/NGRX-IMPLEMENTATION-MIGRATION.md` as completion record only (no stale pre-migration statements).

## Backlog (Deferred)

### v1.2

- [ ] Live Remote Compute Gateway hardening and provenance UX.
- [ ] Production moderation/auth gating refinements for community flows.
- [ ] Release packaging and symposium narrative finalization.

### v2+

- [ ] Mode B viewer track.
- [ ] FITS proxy/pass-through (policy-gated).
- [ ] Optional performance microservice path (only if profiling justifies complexity).

## Guardrails

- Keep roadmap forward-looking; completed implementation history should be concise in `TODO.md` only.
- Prefer one source of truth per topic (avoid repeating long sprint logs across multiple docs).
- Every roadmap item should map to an executable Nx validation target when feasible.

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
