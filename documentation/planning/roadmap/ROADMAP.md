# Roadmap

Status date: 2026-02-16

Canonical scope: `documentation/product/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`.
Industry/external references: `documentation/overview/EXTERNAL-CLAIMS-REFERENCES-APPENDIX-2026-02-11.md` and `documentation/overview/EXTERNAL-ASSET-METADATA-2026-02-11.md`.

**Technical reference:** See [../../architecture/ARCHITECTURE.md](../../architecture/ARCHITECTURE.md) for detailed MVP stack and systems integration notes.

Tracking rule:

- `ROADMAP.md` is forward-looking (what is next).

- Completed implementation history is journaled in `TODO.md` ("Archived Completed Items") and release notes.

## Near-Term Sprint (2026-02-15 to 2026-02-28): Release Readiness and Integration Hardening

Objective: preserve deterministic local execution while finishing release-facing quality and integration tasks.

Execution note (2026-02-16):

- Broker comparison dashboard hardening is complete (warmup prefetch, warm-start rendering, and change-detection stability work).
- Remaining broker-evaluation work is benchmark artifact publication and ADR/consolidation decision updates.

1. Release readiness

- Calibrate Lighthouse mobile assertions and artifact baselines in CI.
- Finalize public repository metadata and release checklist.
- Reduce expected startup warning noise in local run output.

1. Remote compute gateway (next execution step)

- Transition simulated TACC orchestration flow to real API integration path.
- Add secure credential/header handling for remote compute requests.
- Persist job audit trail records in PostgreSQL.

1. Provenance and explainable UX

- Link job outputs to persistent Aladin snapshots.
- Add initial agent performance monitoring surfaces.
- Update symposium packet artifacts for 2026 conference use.

1. Documentation and governance hygiene

- Add source/date attribution table for external trend claims.
- Keep roadmap references constrained to existing docs paths.
- Keep canonical scope docs synchronized with delivered post-MVP features.

## Upcoming Sprint: Event Streaming & Scalability (starting Feb 2026)

Objective: build the core publish/subscribe infrastructure that will
support job events, notifications, and downstream dashboards.

- Sprint 5.3: Job event publishing (Rabbit/Kafka) with comprehensive test
  coverage and latency instrumentation.
- Sprint 6.1: WebSocket foundation and dashboard data feeds (follow-on
  once 5.3 is ready).
- This work feeds into the longer-term Remote Compute Gateway and
  Provenance/UX phases.

## Recently Completed (2026-02-16)

- Completed reliability and contract hardening sprint goals (security boundary, env unification, messaging reliability, docs consistency, CI formatting gate).
- Finished full security/operations hardening plan (phases 0‑7) with documentation published in `documentation/hardening/HARDENING-PLAN.md`.
- Hardened WebSocket `/messaging` gateway (JWT handshake auth + origin allowlist + gateway tests).
- Unified API env loading with shared loader and removed duplicated parsing paths.
- Standardized canonical backend env keys in `.env.example` (`DB_USER`, `DB_NAME`, `API_PORT`) with transitional aliases.
- Aligned env docs to canonical backend key names.
- **Broker comparison dashboard hardening completed**: startup warmup, warm-start cache, measured/fallback quality tagging, and runtime stabilization for broker polling updates.
- **Broker integration evaluation stack operational**: Pulsar, RabbitMQ, and Kafka infrastructure available with real-time monitoring dashboard.
- Restored `documentation/index/OVERVIEW-V2.md`.
- Added runtime env schema validation and canonical/alias conflict checks.
- Removed fixed messaging sleeps and metadata suppression; added retry/backoff publish path.
- Accepted and regenerated OpenAPI contract delta for `/api/messaging/stats`.
- Added changed-file formatting gate to CI (`format:check:changed`).
- Fixed OpenAPI regression check runner to use one-shot target (`cosmic-horizons-api:openapi`).
- Hardened duplicate-registration e2e test path to reduce flake.
- Added local reviewer security boundaries to `documentation/setup/ENVIRONMENT-CONFIG.md`.
- Verified `pnpm e2e:mvp` passing after e2e hardening.
- Completed internal docs hub vertical slice (`/docs` route + markdown rendering + backend docs content endpoint).
- Linked architecture and audit strategy references inside frontend docs hub.
- Completed compact telemetry widget UX polish on landing/auth routes.

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

- Status: complete (posts, moderation, and internal documentation hub complete)

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

## v1.2 (Scale and AI Gateway) — In-Progress

Implementation details are tracked in active execution notes in `TODO.md` until dedicated phase docs are restored.

- **Remote Job Orchestration Spike**: Implement backend simulations and frontend console for TACC-scale AI agent steering (AlphaCal, CosmicAI).
- **Symposium Narrative**: Draft strategic artifacts for the "Explainable Universe" theme and Charlottesville 2026.
- **Type Hardening**: Enforce strict TypeScript interfaces across the API gateway to eliminate implicit `any` and `unknown` types.
- **Explainable UI Framework**: Initial prototypes for documentation of AI-driven results via persistent Aladin snapshots.
- Feed ranking and discovery improvements
- Target resolution enhancements for minor planets and comets

## Phase 2: AI Integration Foundation

- Pillar 1: Inference service layer (calibration anomaly detection, AlphaCal, event detection)

- Pillar 2: GPU job orchestration (local + Kubernetes-ready)

- Pillar 3: Reproducibility framework (experiment graphs, versioning, replay)

- Pillar 4: Explainability UI (saliency, attribution, confidence scoring)

**Strategic alignment:** NSF-Simons CosmicAI Institute
**Timeline:** ~12–16 weeks
**Cost:** $100K–$200K (engineering labor)
**Milestone:** cosmic-horizons becomes AI-driven scientific platform

## Phase 3: CosmicAI Federation & ngVLA Preparation

- Pillar 1: Dataset federation (NRAO + CosmicAI curations + TACC)

- Pillar 2: TACC compute integration (Slurm + remote job orchestration)

- Pillar 3: Multi-site reproducibility (federated lineage tracking)
  - **NRAO Radar Integration**: Messaging frameworks (Kafka/RabbitMQ) for inter-site job notification.
  - **Site-to-Site Benchmarking**: Latency profiling and data-bus throughput metrics for ngVLA scale.
  - **Common System Software**: Integrated Radar visualization (Range-Doppler) in the AI Control Plane.
  - See active planning notes in `TODO.md` and `SCOPE-LOCK.md` until dedicated phase docs are restored.

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
5. [x] Publish a symposium packet (architecture, gates, scope boundaries, integration-ready APIs).

## Phase 4: Remote Compute & TACC Orchestration (ACTIVE)

- **Status**: Spike COMPLETED (Feb 2026).
- **Core Narrative**: Bridging the "Human Bottleneck" via the Remote Compute Gateway.
- **Next High-Priority**: Transition from simulation to live TACC API headers; Job-to-Snapshot provenance linkage.

## Funding & Cost Strategy

Funding-specific artifacts are tracked separately and should be re-linked here only when their canonical file paths are restored.

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

_Cosmic Horizon Development - (c) 2026 Jeffrey Sanford. All rights reserved._

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
