# Test Matrix (MVP)

Status date: 2026-02-11

## Required Gates

- `pnpm nx run-many --target=test --all`

- `pnpm nx run docs-policy:check`

- `pnpm nx run mvp-gates:e2e`

## Current Validation Snapshot (2026-02-11)

- `docs-policy:check`: pass
- `run-many --target=test --all`: pass (177 tests)
- `mvp-gates:e2e`: pass (13 web MVP + 1 perf + 26 API e2e)
- Caveat: Nx marked `mvp-gates:e2e` as flaky in one run; monitor stability.

## Pillar-Specific Gate Notes

- Pillar 1 performance gate (`apps/vlass-web-e2e/src/perf.spec.ts`) enforces:
  - `FCP < 1000ms`
  - `LCP < 2000ms`
- Pillar 2 retention policy gate (`apps/vlass-api/src/app/viewer/viewer.service.spec.ts`) enforces:
  - Snapshot retention floor is `>= 7` days even if environment config is lower.

## Unit/Integration Focus

- Shared models contracts

- API auth/post/revision behavior (Jest)

- Web app component/service behavior (Vitest)

- Viewer tile prefetch/cache service behavior (Vitest)

- Auth UX flows via Playwright MVP suite

## Deferred Test Areas

- Mode B visual parity tests (v2)

- Nest <-> Go contract tests (v2)

## - FITS proxy compliance tests (v2)
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
