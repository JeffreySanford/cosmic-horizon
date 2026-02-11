# Roadmap

Status date: 2026-02-08

Canonical scope: `documentation/product/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`.
Industry context note: `documentation/planning/INDUSTRY-CONTEXT-AND-FEASIBILITY-2026-02-11.md`.
External-claims workflow: `documentation/governance/EXTERNAL-RESEARCH-WORKFLOW.md`.

**Technical reference:** See [../../architecture/TECHNICAL-ARCHITECTURE.md](../../architecture/TECHNICAL-ARCHITECTURE.md) for detailed MVP stack, development operations, and v1.1/2.0 planning.

Tracking rule:

- `ROADMAP.md` is forward-looking (what is next).

- Completed implementation history is journaled in `TODO.md` ("Archived Completed Items") and release notes.

## MVP (v1.0)

1. Pillar 1: SSR first paint

- Landing SSR preview

- Performance tuning for FCP/LCP targets

- Status: complete (SSR regional preview on auth/landing, client-only telemetry overlay, gated perf tests)

1. Pillar 2: Viewer + permalink + snapshots

- Aladin integration (Mode A only)

- Viewer state encoding/decoding

- Persistent permalink resolution

- PNG snapshot workflow

- Labeling centered targets in viewer state

- FITS science cutout download path

- Status: complete (Mode A + state/permalink/snapshot/cutout + reliability hardening + telemetry dashboarding)

1. Pillar 3: Community notebooks

- Post create/edit/read

- Revision history and diff

- Moderation controls for posts

- Tag workflow

- Status: complete (post create/edit/publish + revisions + hide/lock moderation flow are implemented and tested)

1. Foundations

- Auth + verification gates

- Audit logging

- Rate limiting

- CI baseline test gate

## v1.0 Completion

- MVP pillars are implemented in local environment.

- Remaining work before public deployment is operational hardening (performance tuning, CI trend baselines, release packaging).

- **Label hover feature**: Completed with 1-second debounce for bandwidth efficiency

- **Planet resolution**: Multi-layered fallback resolver (Aladin → SkyBot → VizieR → Hardcoded) implemented and documented

## v1.1 (Quick wins) — Active Development

### Interim: Scientific Ephemeris Backend (COMPLETED)

See [../phases/PHASE-2-EPHEMERIS-BACKEND.md](../phases/PHASE-2-EPHEMERIS-BACKEND.md) for detailed implementation.

- High-precision coordinate resolution using `astronomy-engine` (TS) and JPL fallback (v1.1 feature).

- Real-time planet/asteroid positions (±0.1 arcsecond accuracy).

- Daily pre-warming cache job (00:00 UTC) with 8-day lookahead.

- Redis and Memory multi-tier caching (24h TTL).

- Full vertical integration into Aladin Viewer search.

### Milestone: Community Content Engagement (COMPLETED)

- **Threaded Comments Backend**: Multi-level nesting support with circular reference protection.
- **Threaded Comments Frontend**: Recursive component architecture with Material Design integration.
- **Authentication Integration**: Role-based action gating (post owner moderation, author-only edits).
- **Quality Gates**: 5/5 E2E coverage for comment lifecycle; full logic and UI lint passing.

### Other v1.1 Features (Planned Next)

- User profile polish
- Feed ranking and discovery improvements
- Target resolution enhancements for minor planets and comets

## Phase 2: AI Integration Foundation

See [../phases/PHASE-2-README.md](../phases/PHASE-2-README.md) for overview and [../phases/PHASE-2-AI-INTEGRATION.md](../phases/PHASE-2-AI-INTEGRATION.md) for detailed planning.

- Pillar 1: Inference service layer (calibration anomaly detection, AlphaCal, event detection)

- Pillar 2: GPU job orchestration (local + Kubernetes-ready)

- Pillar 3: Reproducibility framework (experiment graphs, versioning, replay)

- Pillar 4: Explainability UI (saliency, attribution, confidence scoring)

**Strategic alignment:** NSF-Simons CosmicAI Institute
**Timeline:** ~12–16 weeks
**Cost:** $100K–$200K (engineering labor)
**Milestone:** vlass-portal becomes AI-driven scientific platform

## Phase 3: CosmicAI Federation & ngVLA Preparation

See [../phases/PHASE-3-README.md](../phases/PHASE-3-README.md) for overview and [../phases/PHASE-3-COSMICAI-FEDERATION.md](../phases/PHASE-3-COSMICAI-FEDERATION.md) for detailed planning.

- Pillar 1: Dataset federation (NRAO + CosmicAI curations + TACC)

- Pillar 2: TACC compute integration (Slurm + remote job orchestration)

- Pillar 3: Multi-site reproducibility (federated lineage tracking)

- Pillar 4: Explainability aggregation (multi-model consensus, uncertainty quantification)

**Strategic alignment:** TACC partnership, ngVLA operations preparation
**Timeline:** ~16–20 weeks
**Cost:** $200K–$400K (engineering + compute, often grant-funded)
**Milestone:** vlass-portal becomes scientific operations platform for radio astronomy AI workflows

## Integration Readiness Track (Cross-Phase)

To keep external positioning grounded in executable work:

1. Add integration contracts for remote job control (`submit`, `status`, `cancel`) behind feature flags.
2. Add run-audit trail and lineage metadata model extension in shared models.
3. Add "independent/non-affiliated" presentation checklist to demo/release workflow.
4. Keep external ecosystem claims source-dated and marked as planning hypotheses until verified.
5. Publish a symposium packet (architecture, gates, scope boundaries, integration-ready APIs).

## Funding & Cost Strategy

See [FUNDING-AND-COSTS.md](../funding/FUNDING-AND-COSTS.md) for comprehensive cost breakdown, grant strategy, and timeline to funding (NSF SI², DOE ASCR, NVIDIA GPU Research, NSF CIS).

## v2 (Deferred to Post-Phase 3)

- Mode B canvas viewer

- FITS proxy/caching and advanced download controls

- Optional Rust render tier for heavy compute paths

- Comments/replies on posts

## Out of Scope for MVP (Phases 1–3)

- Go microservice (removed from MVP; may revisit for specialized data processing)

- Full FITS archive/mirror tier (cutout passthrough suffices; proxy deferred)

- Custom model training or fine-tuning

## - ngVLA data ingestion (await official ngVLA data release; infrastructure ready by Phase 3)
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
