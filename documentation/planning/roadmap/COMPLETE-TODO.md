# Completed TODO Items

Status date: 2026-02-22

This document collects tasks that have been checked off and removed from `TODO.md`.
Use it as an archive of what’s already been done; `TODO.md` should now contain only open work.

## Current State Snapshot

- Angular NgRx migration complete for scoped domains (`auth`, `ui`, `jobs`, `alerts`, `logs`, `telemetry`, `ephemeris`, `router`).
- Viewer SSR route resolver enabled with TransferState hydration and preload shaping.
- SSR telemetry counters implemented (`bootstrap` hit/miss, `TransferState` hit/miss + hit rate).
- Docs policy checks pass (`pnpm nx run docs-policy:check`).
- Baseline Nx quality gates pass locally (`lint`, `test`, `e2e`).

## Phase 0 – Real‑Data Jobs Integration

- Dataset staging and sample MS selection.
- `docker-compose.astronomy.yml` profile with CASA/WSClean.
- `CasaAdapter` stub implementation and runtime gating.
- Metadata extraction helper (`casa listobs`).
- Prompt enrichment with dataset metadata.
- Reference architecture diagrams drafted in `ideas/jobs-real-data/architecture-diagram.md`.

## CI / Quality Follow-up

- Fix webpack compilation error caused by relocated guard module and SCSS unmatched brace (2026-02-22).
- Finalise local-LLM CI shard: installed `zod` workspace dependency, added webpack module path, verify e2e --grep llm runs locally (note: API service readiness issue still being addressed).
- Remove remaining web e2e startup noise (`/api` proxy ECONNREFUSED bursts during early boot).
  - Ensure API service readiness before frontend traffic in Playwright web server startup.
  - Keep runtime-warning specs focused on Angular/runtime issues, not startup proxy churn.
- Keep GitHub Actions green with changed-file format checks and Lighthouse thresholds. _(prettier fixes applied, thresholds calibrated)_
- Revisit Nx Cloud strategy for atomized `e2e-ci` aggregate target; evaluation complete.
  - Local execution note: aggregate `cosmic-horizons-web-e2e:e2e-ci` requires Nx Cloud.
  - Local equivalent currently validated by running all `e2e-ci--src/*` targets directly.
  - Decision: continue with existing shards and monitor credit use; no immediate changes required.
