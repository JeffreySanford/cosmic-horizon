# TODO

Status date: 2026-02-08

Canonical scope:
`documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## MVP Priorities

- [x] Complete Pillar 2 operational telemetry dashboarding for cutout provider reliability
- [x] Complete post and revision workflows
- [x] Complete post moderation path (hide/lock)
- [ ] Keep docs aligned with source-of-truth models

## Next Steps (Local Pre-Deploy)

**Phase 2 (v1.1) - Scientific Ephemeris Backend**: Starting now  
See `documentation/planning/phases/PHASE-2-EPHEMERIS-BACKEND.md` for detailed plan

- [ ] Sprint 1: Astropy integration foundation (Weeks 1-2)
  - [ ] Set up Python ephemeris calculator with Astropy
  - [ ] Implement NestJS /api/view/ephem endpoint
  - [ ] Redis caching layer with 24h TTL
  - [ ] Integration and error handling tests

- [ ] Sprint 2: Optimization and extended objects (Weeks 3-4)
  - [ ] JPL Horizons fallback for asteroids
  - [ ] Daily precomputation job for cache warming
  - [ ] E2E testing and performance tuning (<500ms p95)

- [ ] Sprint 3: Polish and release (Weeks 5-6)
  - [ ] UI verification (no changes needed)
  - [ ] Documentation and API specs
  - [ ] Staging deployment and monitoring
  - [ ] Production rollout (gradual)

**MVP Pre-Deploy Checklist** (Before Public Release):

- [ ] Run full release gate locally and record results:
  `pnpm nx run docs-policy:check && pnpm nx run-many --target=test --all && pnpm nx run mvp-gates:e2e`
- [ ] Finish Pillar 3 workflow gaps: post lifecycle edge cases, revision diff UX, and moderation hide/lock flow completion
- [ ] Add API contract regression check in CI (OpenAPI diff check against committed `documentation/reference/api/openapi.json`)
- [ ] Calibrate Lighthouse mobile assertions and keep artifact baselines in CI for trend comparison
- [ ] Reduce login route Lighthouse FCP/performance regressions (currently warning-level in local mobile profile)
- [ ] Finalize public-repo metadata checklist: description, topics, website link, and security feature toggles in GitHub settings
- [ ] Standardize affiliation disclaimer footer in remaining long-form docs (`documentation/frontend/*`, ADR set)

## Archived Completed Items

Completed on 2026-02-10:

- [x] Implement label hover with responsive debouncing
  Added mouseleave handler to clear labels when cursor exits viewer canvas
  Adjusted debounce from 300ms to 1000ms (1 second) for bandwidth efficiency
  Labels now appear on hover and disappear when cursor moves off
  See `apps/vlass-web/src/app/features/viewer/viewer.component.html` and `.ts`

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
