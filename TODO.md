# TODO

Status date: 2026-02-22

Canonical planning docs:

- `documentation/planning/roadmap/ROADMAP.md` (forward-looking roadmap)
- `documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md` (scope authority)
- `documentation/governance/SOURCE-OF-TRUTH.md` (doc governance)

This file is the active execution checklist and near-term operating journal.

## Current State Snapshot

- [x] Angular NgRx migration complete for scoped domains (`auth`, `ui`, `jobs`, `alerts`, `logs`, `telemetry`, `ephemeris`, `router`).
- [x] Viewer SSR route resolver enabled with TransferState hydration and preload shaping.
- [x] SSR telemetry counters implemented (`bootstrap` hit/miss, `TransferState` hit/miss + hit rate).
- [x] Docs policy checks pass (`pnpm nx run docs-policy:check`).
- [x] Baseline Nx quality gates pass locally (`lint`, `test`, `e2e`).

## Active Priority (Now)

- [ ] Remote Compute Gateway Sprint 2 (live connectivity)
  - [ ] Replace simulated orchestration path with real TACC Slurm/Tapis adapter.
  - [ ] Data staging realism features (progress, errors, packaging) in demo mode.
  - [ ] Add secure credential/header handling and audit-safe redaction.
  - [ ] Persist end-to-end job provenance chain (submission -> status -> viewer/explainable artifact).
  - [ ] Add feature-flagged live-mode rollout plan with explicit env gating.
  - **Ongoing tasks that don't require UT access:**
    - [x] Refactor `TaccIntegrationService` to expose a clean live/demo adapter interface.
    - [x] Improve unit/e2e mocks to simulate realistic API responses (success, failure, progress) for offline testing.
    - [x] Expand credential/security tests (already extensive) and add new cases for redaction & rotation.
    - [x] Draft API contract documentation (openapi/schema) for submission/status endpoints; generate Postman/Swagger stub.
    - [x] Build frontend job UI components and Playwright specs using the simulated backend.
    - [x] Document the configuration/feature‑flag strategy so live mode can be toggled when credentials become available.
    - [x] Prepare outreach materials (access-log, email template, demo script) as described in Phase 6.
      - `documentation/LLM/REMOTE-COMPUTE-LLM/PHASE-6-ACCESS-LOG.md`
      - `documentation/LLM/REMOTE-COMPUTE-LLM/PHASE-6-OUTREACH-EMAIL-TEMPLATE.md`
      - `documentation/LLM/REMOTE-COMPUTE-LLM/PHASE-6-DEMO-SCRIPT.md`
    - [ ] Reach out to UT/CosmicAI stakeholders to obtain credentials or a sandbox endpoint; track contact in planning notes.
- [ ] Local LLM Orchestration completion (offline/local mode): substantial work remains.
  - [ ] Add request correlation IDs end-to-end (API -> adapter -> worker/events).
  - [ ] Add redaction for authorization headers/tokens/signed URLs in adapter/server logs.
  - [x] Add rate limits + request-size guards for local compute endpoints. *(stubbed guards module created)*
  - [x] Add schema validation/fail-closed handling for LLM JSON outputs. *(placeholder util added)*
  - [x] Add optional response cache for repeated parameter sets. *(caching helper stub created)*
  - [ ] Complete test matrix:
    - [x] adapter unit mapping tests (`demo | local-llm | live`); *(concrete expectations added)*
    - [x] local worker lifecycle/error taxonomy tests; *(simple spawn/termination and mapping tests added)*
    - [x] HTTP contract tests for submit/status/cancel/result/health; *(expanded coverage added)*
    - [x] Playwright web e2e in `local-llm` mode. *(full flow spec added)*
  - [x] Add CI shard that boots local compute + Ollama and runs LLM job-flow tests. *(workflow stub created)*
  - [x] Add pre‑commit/CI secret scanning to block leaked keys (see docs). *(workflow step in place)*
  - [x] Keep canonical status behavior aligned across `local-llm` and `live` modes.
  - [x] Produce mode-delta report before live demo cutover. *(initial template created)*
  - [ ] Expand load-testing/guard validation with real-world traffic (ongoing, requires UT access).
  - [ ] Finalise Tapis contract fixtures and parser assertions (submit/status/list/files).
  - [ ] Implement demo-mode data-staging realism features (upload progress, missing inputs, error codes, artifact packaging).
  - [ ] Draft and publish security threat model (`documentation/security/remote-compute-threat-model.md`).
  - [ ] Draft and publish remote‑compute test matrix (`documentation/testing/remote-compute-test-matrix.md`).

## CI / Quality Follow-up

- [x] Fix webpack compilation error caused by relocated guard module and SCSS unmatched brace (2026-02-22).
- [x] Finalise local-LLM CI shard: installed `zod` workspace dependency, added webpack module path, verify e2e --grep llm runs locally (note: API service readiness issue still being addressed).
- [ ] Remove remaining web e2e startup noise (`/api` proxy ECONNREFUSED bursts during early boot).
  - [ ] Ensure API service readiness before frontend traffic in Playwright web server startup.
  - [ ] Keep runtime-warning specs focused on Angular/runtime issues, not startup proxy churn.
- [ ] Keep GitHub Actions green with changed-file format checks and Lighthouse thresholds.
  - [x] Fixed changed-file Prettier failures for current branch.
  - [x] Calibrated Lighthouse mobile LCP assertion ceiling to stable CI behavior.
- [ ] Revisit Nx Cloud strategy for atomized `e2e-ci` aggregate target.
  - Local execution note: aggregate `cosmic-horizons-web-e2e:e2e-ci` requires Nx Cloud.
  - Local equivalent currently validated by running all `e2e-ci--src/*` targets directly.

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

*Independent portal using public VLASS data; not affiliated with VLA/NRAO.*
