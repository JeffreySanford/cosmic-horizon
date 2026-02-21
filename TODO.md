# TODO

Status date: 2026-02-21

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
  - [ ] Add secure credential/header handling and audit-safe redaction.
  - [ ] Persist end-to-end job provenance chain (submission -> status -> viewer/explainable artifact).
  - [ ] Add feature-flagged live-mode rollout plan with explicit env gating.

## CI / Quality Follow-up

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

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
