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

1. Pillar 3: Community notebooks & Documentation

- Post create/edit/read

- Revision history and diff

- Moderation controls for posts

- **Internal Documentation Hub**: Centralized technical and scientific guides within the portal UI.

- Status: In-Progress (Posts and moderation complete; Documentation hub scaffolded)

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

## v2.0 (Exascale Array Control Plane) — COMPLETED

See [../../messaging/ARRAY-MESSAGING-DESIGN.md](../../messaging/ARRAY-MESSAGING-DESIGN.md) for full architecture.

- **Dual-Plane Messaging**: Separation of Telemetry (RabbitMQ) from Raw Data (Kafka) to support 240 PB/year ngVLA data flows.
- **Topology Map**: Real-time D3.js visualization of 5 remote sites and 60 array elements with animated data flow.
- **Robust Observability**: Redis-backed central logger with strict recursive loop prevention (Interceptor exclusions + Native Fetch bypass).
- **Auditability**: Remote frontend logging endpoint (`/api/logging/remote`) for full system traceability.

## v1.2 (Scale and AI Gateway) — In-Progress

See [../../architecture/TACC-JOB-ORCHESTRATION-SPIKE.md](../../architecture/TACC-JOB-ORCHESTRATION-SPIKE.md) for detailed implementation.

- **Remote Job Orchestration Spike**: Implement backend simulations and frontend console for TACC-scale AI agent steering (AlphaCal, CosmicAI).
- **Symposium Narrative**: Draft strategic artifacts for the "Explainable Universe" theme and Charlottesville 2026.
- **Type Hardening**: Enforce strict TypeScript interfaces across the API gateway to eliminate implicit `any` and `unknown` types.
- **Explainable UI Framework**: Initial prototypes for documentation of AI-driven results via persistent Aladin snapshots.
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
**Milestone:** cosmic-horizons becomes AI-driven scientific platform

## Phase 3: CosmicAI Federation & ngVLA Preparation

See [../phases/PHASE-3-README.md](../phases/PHASE-3-README.md) for overview and [../phases/PHASE-3-COSMICAI-FEDERATION.md](../phases/PHASE-3-COSMICAI-FEDERATION.md) for detailed planning.

- Pillar 1: Dataset federation (NRAO + CosmicAI curations + TACC)

- Pillar 2: TACC compute integration (Slurm + remote job orchestration)

- Pillar 3: Multi-site reproducibility (federated lineage tracking)
  - **Array Messaging Integration**: Messaging frameworks (Kafka/RabbitMQ) for inter-site job notification.
  - **Site-to-Site Benchmarking**: Latency profiling and data-bus throughput metrics for ngVLA scale.
  - **Common System Software**: Integrated Array Mapping visualization in the AI Control Plane.
  - See: [../../messaging/STRATEGIC-MESSAGING-PLAN.md](../../messaging/STRATEGIC-MESSAGING-PLAN.md)

- Pillar 4: Explainability aggregation (multi-model consensus, uncertainty quantification)

**Strategic alignment:** TACC partnership, ngVLA operations preparation
**Timeline:** ~16–20 weeks
**Cost:** $200K–$400K (engineering + compute, often grant-funded)
**Milestone:** cosmic-horizons becomes scientific operations platform for radio astronomy AI workflows

## Integration Readiness Track (Cross-Phase)

To keep external positioning grounded in executable work:

1. [x] Add integration contracts for remote job control (`submit`, `status`, `cancel`) behind feature flags. (Simulated in `JobsModule`)
2. [ ] Add run-audit trail and lineage metadata model extension in shared models.
3. [ ] Add "independent/non-affiliated" presentation checklist to demo/release workflow.
4. [ ] Keep external ecosystem claims source-dated and marked as planning hypotheses until verified.
5. [x] Publish a symposium packet (architecture, gates, scope boundaries, integration-ready APIs). (`SYMPOSIUM-2026-NARRATIVE-DRAFT.md`)

## Phase 4: Remote Compute & TACC Orchestration (ACTIVE)

- **Status**: Spike COMPLETED (Feb 2026).
- **Core Narrative**: Bridging the "Human Bottleneck" via the Remote Compute Gateway.
- **Next High-Priority**: Transition from simulation to live TACC API headers; Job-to-Snapshot provenance linkage.

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

*Cosmic Horizon Development - (c) 2026 Jeffrey Sanford. All rights reserved.*

---
*Independent portal using public VLASS data; not affiliated with VLA/NRAO.*
