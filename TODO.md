# TODO

Status date: 2026-02-07

Canonical scope:
`documentation/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## MVP Priorities

- [ ] Complete Pillar 2 operational telemetry dashboarding for cutout provider reliability
- [ ] Complete post and revision workflows
- [ ] Complete post moderation path (hide/lock)
- [ ] Keep docs aligned with source-of-truth models

## Archived Completed Items

Completed on 2026-02-07:

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
