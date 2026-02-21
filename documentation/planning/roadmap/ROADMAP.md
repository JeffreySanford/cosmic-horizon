# Roadmap

Status date: 2026-02-21

Canonical scope: `documentation/product/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`.
Tracking rule: this file is forward-looking only; completed implementation history belongs in `TODO.md`.

## Current Baseline

- MVP + v1.1 hardening are complete and stable.
- Route-aware app shell/header/footer + MD3 styling system are implemented.
- Community + moderation mock-mode workflows now have seeded demonstration data.

## Next Big Step (Priority 1)

### Remote Compute Gateway Sprint 2 (Live Connectivity)

Objective: move from simulated orchestration to live remote compute integration while preserving test and audit quality.

- Implement real TACC Slurm/Tapis job orchestration adapter.
- Add secure credential handling and rotation-safe request headers.
- Persist live job audit/provenance records in PostgreSQL.
- Link job outputs to explainable UI records (snapshot/provenance chain).

Exit criteria:

- Live path is feature-flagged and environment-gated.
- Full Nx quality gates pass (`lint`, `test`, `e2e`, `e2e:ci`).
- Audit logs capture request identity, action, and outcome for live jobs.

## Near-Term Stream (Priority 2)

### Release and Governance Hygiene

- Finalize release notes for the styling/header/community wave.
- Resolve stale/broken documentation links and keep docs index current.
- Keep docs-policy and markdown quality checks green.

## Near-Term Stream (Priority 3)

### Community and Moderation Production Controls

- Keep mock mode as default for demo flows.
- Gate live posting/storage behavior by auth + role + runtime mode.
- Expand table UX for moderation (filter/sort/pagination/detail view) with coverage.

## Strategic Milestone

- Symposium: Cosmic Horizons Conference 2026 (Charlottesville, VA).
- Abstract deadline: April 1, 2026.
- Readiness target: stable live-gateway demo narrative with explainable provenance.

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
