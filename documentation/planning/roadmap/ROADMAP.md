# Roadmap

Status date: 2026-02-21

Canonical scope: `documentation/product/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`.
Tracking rule: this document is forward-looking only; completed implementation history belongs in `TODO.md`.

## Baseline (Current)

- Angular app state migration to NgRx is complete in scoped domains.
- SSR viewer preload resolver is active with TransferState hydration.
- SSR performance telemetry counters are implemented for bootstrap/TransferState hit-rate tracking.
- Core local quality gates are green (`lint`, `test`, `e2e`).

## Priority 1: Remote Compute Gateway (v1.2)

### Sprint 2 (Live Connectivity)

Objective: move from simulation to real remote orchestration while preserving auditability and release safety.

- Implement TACC Slurm/Tapis live adapter and request/response mapping.
- Add secure secret/header handling with redaction and operational guardrails.
- Persist durable job provenance and outcome records in PostgreSQL.
- Maintain feature-flagged runtime mode split (demo/mock vs live).

Exit criteria:

- Live mode behind explicit config gates and role controls.
- End-to-end provenance chain queryable per job.
- All core gates green: `lint`, `test`, `e2e`.
- CI strategy defined for `e2e-ci` (Nx Cloud aggregate or documented local-equivalent shards).

## Priority 2: CI Signal Quality

- Eliminate startup proxy-noise warnings in web e2e by tightening service readiness ordering.
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
