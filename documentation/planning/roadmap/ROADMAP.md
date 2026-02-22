# Roadmap

Status date: 2026-02-22

*(Completed items have been moved to `COMPLETED-ROADMAP.md`.)*

Canonical scope: `documentation/product/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`.
Tracking rule: this document is forward-looking only; completed implementation history belongs in `TODO.md`.

## Baseline (Current)

- Angular app state migration to NgRx is complete in scoped domains.
- SSR viewer preload resolver is active with TransferState hydration.
- SSR performance telemetry counters are implemented for bootstrap/TransferState hit-rate tracking.
- Core local quality gates are green (`lint`, `test`, `e2e`).

## Priority 0: Real‑Data Jobs Integration (astronomy mode)

Objective: build an end-to-end demo that runs actual astronomical measurement set files through a local compute path.  This work can proceed without any external academic or TACC credentials and keeps the team productive while live access is pending.

- Follow the phased plan documented in `documentation/ideas/jobs-real-data/phases-and-steps.md`.
  - Phase 1: dataset selection, docker profile, adapter stub.
  - Phase 2: metadata extraction and LLM prompt enrichment.
  - Later phases: queuing architecture, CASA worker, frontend UX and CI tests.
- Deliver a working job submission flow that produces a FITS image from sample data and surfaces the result in the Jobs UI.

Exit criteria:

- Sample dataset(s) are available via `astronomy-data/` or helper script.
- `ASTRO` compose profile boots CASA/WSClean and the API selects a `CasaAdapter` stub.
- Frontend shows dataset choice and real‑data progress messages.
- A simple job run completes with a valid FITS artifact.

## Priority 1: Remote Compute Gateway (v1.2)

### Sprint 2 (Live Connectivity)

Objective: move from simulation to real remote orchestration while preserving auditability and release safety.  
_(demo/simulated pathway and UI already in place; this sprint focuses on the live adapter and gating.)_

- Implement TACC Slurm/Tapis live adapter and request/response mapping.
- Add secure secret/header handling with redaction and operational guardrails.
- Persist durable job provenance and outcome records in PostgreSQL.
- Maintain feature-flagged runtime mode split (demo/mock vs live).
- Complete contract fixtures and parser assertions for Tapis job operations (submit/status/list/files).
(completed – see `COMPLETED-ROADMAP.md`)

Exit criteria:

- Live mode behind explicit config gates and role controls.
- End-to-end provenance chain queryable per job.
- All core gates green: `lint`, `test`, `e2e`.
- CI strategy defined for `e2e-ci` (Nx Cloud aggregate or documented local-equivalent shards).

## Priority 1A: Local LLM Orchestration Completion (v1.2 offline track)

Objective: finish the local-LLM execution path so UI, API, and orchestration behavior are production-shaped before TACC live cutover.  
_(simulation baseline already implemented; remaining work focuses on guardrails and validation.)_

- Complete reliability/security controls:
  - (reliability/security controls completed – see `COMPLETED-ROADMAP.md`)
- Complete contract hardening:
  - Structured JSON schema validation for LLM responses (fail closed + deterministic fallback).
  - Canonical status mapping parity across `demo`, `local-llm`, and `live` modes.
- Complete validation strategy:
  - Adapter unit tests and worker lifecycle/error-class tests.
  - Local compute HTTP contract tests.
  - (web e2e coverage achieved – see `COMPLETED-ROADMAP.md`)
- Publish pre-cutover mode-delta report (`local-llm` vs expected `live` behavior).

Exit criteria:

- Local-LLM mode is stable under lint/test/e2e gates.
- Job-flow suite runs in CI with local compute dependencies (API service boot integrated).
- Status and error taxonomy are identical (or documented deltas) across modes.
- Operational runbook includes readiness/doctor checks and rollback guidance.
- CI adds secret scanning and additional simulated-gateway coverage jobs.
- Publish security threat model and test-matrix docs to complete Phase 4 deliverables.
- Maintain a log of access requests and draft sponsor outreach materials (Phase 6 outreach tasks).

## Priority 2: CI Signal Quality

- Eliminate startup proxy-noise warnings in web e2e by tightening service readiness ordering.
- Introduce pre-commit/CI secret scanning policy to guard against leaked keys.
- Keep changed-file formatting checks consistently green.
- Keep Lighthouse mobile checks stable with documented assertion baselines.

## Priority 3: Documentation Governance

- Keep roadmap, TODO, and README status statements synchronized.
- Remove stale historical duplication from legacy docs and route status to canonical files.
- Maintain docs catalog and consistency checks as mandatory release gate.

## Strategic Milestone

- Symposium: Cosmic Horizons Conference 2026 (Charlottesville, VA).
- Abstract deadline: April 1, 2026.
- Readiness target: live-gateway demonstration with explainable provenance and auditable operator controls.

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
