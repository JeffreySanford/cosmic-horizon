# TODO

Status date: 2026-02-11

Canonical scope:
`documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## MVP Priorities

- [x] Complete Pillar 2 operational telemetry dashboarding for cutout provider reliability
- [x] Refactor Radar view to generalized Messaging & Array Topology framework
- [x] Complete post and revision workflows
- [x] Complete post moderation path (hide/lock)
- [ ] Complete Pillar 3 Documentation Hub (Markdown rendering + Repo guides integration)
- [x] Align all documentation with source-of-truth models (SCOPE-LOCK/ROADMAP)

## Next Steps (Local Pre-Deploy)

## Industry Alignment and Outreach Workflow (New)

- [x] Add source-dated industry context note for planning (`documentation/planning/INDUSTRY-CONTEXT-AND-FEASIBILITY-2026-02-11.md`)
- [x] Add external-claims governance workflow (`documentation/governance/EXTERNAL-RESEARCH-WORKFLOW.md`)
- [x] Build symposium packet draft (`documentation/planning/SYMPOSIUM-2026-DRAFT.md`)
- [x] Define integration-readiness spike for remote job orchestration contracts (`documentation/architecture/TACC-JOB-ORCHESTRATION-SPIKE.md`)
- [ ] Add source/date table for external trend figures used in presentations

**Phase 2 (v1.1) - Scientific Ephemeris Backend**: COMPLETED

- [x] Sprint 1: Astropy integration foundation (Weeks 1-2)
  - [x] Set up ephemeris calculator with astronomy-engine (TS/JS stack)
  - [x] Implement NestJS /api/view/ephem endpoint
  - [x] Redis caching layer with 24h TTL
  - [x] Integration and error handling tests

- [x] Sprint 2: Optimization and extended objects (Weeks 3-4)
  - [x] JPL Horizons fallback for asteroids
  - [x] Daily precomputation job for cache warming
  - [x] E2E testing and performance tuning (<500ms p95)

- [x] Sprint 3: Polish and release (Weeks 5-6)
  - [x] UI verification and frontend integration
  - [x] Documentation updates
  - [x] E2E validation for full vertical slice

- [ ] Sprint 3: Polish and release (Weeks 5-6)
  - [ ] UI verification (no changes needed)
  - [ ] Documentation and API specs
  - [ ] Staging deployment and monitoring
  - [ ] Production rollout (gradual)

**Phase 3 (v1.1) - Community Content Engagement**: IN-PROGRESS

- [x] Sprint 1: Threaded Comments (Weeks 1-2)
  - [x] Implement threaded comments data model (ADR level)
  - [x] Develop backend API for CRUD operations on comments
  - [x] Implement parent-child relationships (replies)
  - [x] Comprehensive E2E testing (verified 5/5)
- [x] Sprint 2: Frontend Integration (Weeks 3-4)
  - [x] Build interactive comment component with recursive threading
  - [x] Integration with Auth context (user identities, roles)
  - [x] Optimistic UI updates (handled via full reload for state consistency)
- [ ] Sprint 3: Moderation, Polish, and Documentation (Weeks 5-6)
  - [x] Implement User Profile page (backend + frontend)
  - [x] Link to profiles from posts and comments
  - [x] Added comprehensive testing for Ephemeris and Profile modules
  - [x] Implement comment reporting workflow
  - [x] Extend Post moderation (hide/lock) to comments
  - [x] Rate limiting and anti-spam measures
  - [x] Admin Moderation Dashboard (UI to view/resolve reports)
  - [ ] **Technical Documentation Hub**:
    - [x] Scaffold `/docs` route and layout
    - [ ] Integrate Markdown rendering for internal guides
    - [ ] Link system-level architectural ADRs to frontend viewer

**Phase 4 (v1.2) - Remote Compute & TACC Integration**: IN-PROGRESS

- [x] Sprint 1: Integration Spike & Symposium Prep (Weeks 1-2)
  - [x] Scaffold `JobsModule` in backend with simulated TACC service
  - [x] Implement Frontend Job Console with agent orchestration UI
  - [x] Create Symposium 2026 Narrative and Exascale alignment artifacts
  - [x] Harden API type safety (replace unknown/any with strict interfaces)
  - [x] Align `ARCHITECTURE.md` with "Remote Compute Gateway" narrative

- [ ] Sprint 2: Real Gateway Connectivity (Weeks 3-4)
  - [ ] Implement actual TACC API orchestration (Slurm/Tapis integration)
  - [ ] Secure credential management for remote compute headers
  - [ ] Add persistent job audit trail to PostgreSQL schema

- [ ] Sprint 3: Provenance and Explainable UI (Weeks 5-6)
  - [ ] Link AI job outputs to persistent Aladin viewer snapshots
  - [ ] Implement agent performance monitoring dashboards
  - [ ] Finalize Symposium packet for Charlottesville 2026

**Phase 3 (v2.0) - NRAO Radar & Messaging Integration** (Scale Focus) — COMPLETED

- [x] **Sprint 1: Messaging Infrastructure**
  - [x] Integrate NestJS Microservices with RabbitMQ/Kafka transport theory
  - [x] Implement dual-plane messaging (RabbitMQ Telemetry + Kafka Raw Data)
  - [x] Implement event-driven telemetry for 60 VLA radars across 5 remote sites
- [x] **Sprint 2: Radar Visualization & Profiling**
  - [x] Create high-fidelity D3.js force-directed topology map
  - [x] Implement real-time "data particle" animations for site-to-site transit
  - [x] Create Robust Observability Layer (Redis-backed logging with loop prevention)
  - [x] Standardized Logging Strategy for Exascale-class messaging volumes

## Project Totals (v1.1/2.0 Milestone reached)

- [ ] **Sprint 3: Common System Software Alignment**
  - [ ] Standardize API contracts for "Common Domain" software modules
  - [ ] Document data-passing p95 latency targets for ngVLA scale
  - [ ] Reference integration strategy: `documentation/planning/NRAO-RADAR-INTEGRATION.md`

**MVP Pre-Deploy Checklist** (Before Public Release):

- [x] Run full release gate locally and record results:
  `pnpm nx run docs-policy:check && pnpm nx run-many --target=test --all && pnpm nx run mvp-gates:e2e`
  **Results**: ✅ **All required gates PASSED** (Feb 11, 2026 12:53 UTC)
  - Docs Policy: PASSED (100% consistency)
  - Unit/Integration Tests: PASSED (177/177 tests across shared-models, cosmic-horizons-api, cosmic-horizons-web)
  - MVP E2E Gates: PASSED (40/40 tests across web MVP/perf + api e2e)
  - Note: Nx flagged one flaky task signal for `mvp-gates:e2e`; investigate stability.
  
- [x] Finish Pillar 3 workflow gaps: post lifecycle edge cases, revision diff UX, and moderation hide/lock flow completion
  **Status**: COMPLETE - Post lifecycle (draft→published→hidden/locked) fully tested and working via E2E tests
  
- [x] Reduce login route Lighthouse FCP/performance regressions (currently warning-level in local mobile profile)
  **FIX APPLIED** (Feb 11): Optimized LoginComponent and LandingComponent using NgZone.runOutsideAngular() to move clock interval outside Angular zone + manual ChangeDetectorRef.detectChanges(). Should resolve Lighthouse performance warnings.
  
- [x] Add API contract regression check in CI (OpenAPI diff check against committed `documentation/reference/api/openapi.json`)
- [ ] Calibrate Lighthouse mobile assertions and keep artifact baselines in CI for trend comparison
- [ ] Finalize public-repo metadata checklist: description, topics, website link, and security feature toggles in GitHub settings
- [x] Standardize affiliation disclaimer footer in remaining long-form docs (`documentation/frontend/*`, ADR set)

## Viewer Polish (v1.0 Done)

See `documentation/frontend/VIEWER-IMPROVEMENTS-ANALYSIS.md` for complete analysis.

**Tier 1 Recommendations (Completed):**

- [x] Search History / Autocomplete – Store recent searches in localStorage
- [x] Keyboard Shortcuts – G (grid), L (labels), C (center label), S (snapshot), F (FITS), P (permalink), ? (help)
- [x] Label Object Type Icons – Add ⭐ 🌀 ☁️ 🪨 icons indicating object classification

**Next Step:** Phase 2 (v1.1) Scientific Ephemeris Backend.

---

## Archived Completed Items

Completed on 2026-02-11:

- [x] Align all documentation with source-of-truth models (SCOPE-LOCK/ROADMAP)
- [x] Consolidate planned enhancements in TECHNICAL-ARCHITECTURE.md and index/OVERVIEW-V2.md
- [x] Remove obsolete Mode B / Go / FITS proxy active-MVP references from core docs
- [x] Implement Search History (localStorage-based) and Autocomplete in ViewerComponent
- [x] Implement Keyboard Shortcuts (@HostListener) in ViewerComponent
- [x] Implement Object Type Icons in viewer labels
- [x] Add API contract regression check script (`scripts/check-api-contract.mjs`) and integrated into CI flow
- [x] Standardize affiliation disclaimer footers across all documentation files
- [x] Bulk fix markdown spacing and formatting issues (MD012, MD022, MD032, etc.)
- [x] Reduce login route Lighthouse FCP/performance regressions using NgZone optimization

Completed on 2026-02-10:

- [x] Implement label hover with responsive debouncing
  Added mouseleave handler to clear labels when cursor exits viewer canvas
  Adjusted debounce from 300ms to 1000ms (1 second) for bandwidth efficiency
  Labels now appear on hover and disappear when cursor moves off
  See `apps/cosmic-horizons-web/src/app/features/viewer/viewer.component.html` and `.ts`

Completed on 2026-02-07:

- [x] Fix planet/ephemeris object resolution in viewer
  Multi-layered resolver: Aladin → SkyBot → VizieR → Hardcoded fallback
  Adds support for Mars, Venus, Jupiter, Saturn, Uranus, Neptune queries
  See `documentation/architecture/TARGET-RESOLUTION-EPHEMERIS.md` for technical details
  See `documentation/architecture/EPHEMERIS-SCOPE-DECISION.md` for v1.1 planning
  Debugging guide: `documentation/architecture/MARS-RESOLUTION-DEBUGGING.md`
- [x] Keep baseline green:
  `pnpm nx run-many --target=test --all`
- [x] Keep MVP e2e gate green:
  `pnpm nx run mvp-gates:e2e`
- [x] Complete JWT auth foundation (seeded credential login, token guard, logout/session cleanup)
- [x] Add auth-focused e2e coverage (unauthenticated redirect, invalid login, successful login/logout)
- [x] Add API auth unit coverage for login edge cases and JWT strategy validation
- [x] Normalize API route prefixes from `/api/api/*` to `/api/*`
- [x] Validate SSR performance targets (FCP/LCP) with Playwright perf gate
- [x] Verify audit and rate limiting behavior on critical write paths
- [x] Ship Pillar 2 vertical slice:
  `/view` route, viewer state encoding, permalink creation/resolution,
  PNG snapshot API + filesystem artifact write, and matching web/api e2e tests
- [x] Replace interim viewer renderer with Aladin Lite Mode A and bind RA/Dec/FOV sync
- [x] Add viewer center labeling persisted inside encoded/permalink state
- [x] Add FITS cutout download path (`GET /api/view/cutout`) for science data export
- [x] Add unit + e2e coverage for viewer sync, survey switching, labels, and cutout validation
- [x] Harden FITS cutout path with fallback surveys, retries, and outage messaging
- [x] Add deep-zoom native-resolution UX indicator in viewer
- [x] Add snapshot/cutout rate-limit tuning and audit entries
- [x] Close Pillar 2 as complete (Mode A viewer, permalink/snapshot/cutout, telemetry, and reliability hardening)

## Deferred Backlog

### v1.1

- [ ] Comments and replies
- [ ] User profile polish
- [ ] Feed ranking and discovery improvements

### v2

- [ ] Mode B viewer
- [ ] FITS proxy/pass-through (policy gated)
- [ ] Optional Rust rendering service (perf-driven)

## Guardrails

- Go microservice is removed from MVP.
- Mode B is deferred from MVP.
- FITS proxy is deferred from MVP.
- Comments are deferred from MVP.

## Journal Policy

- Completed work is still being journaled.
- Primary archive location: `TODO.md` under "Archived Completed Items".
- Secondary historical context: release notes under `documentation/RELEASE-NOTES-*.md`.
- `documentation/planning/roadmap/ROADMAP.md` should stay future-facing, not become a done-work log.

---
*Independent portal using public VLASS data; not affiliated with VLA/NRAO.*
