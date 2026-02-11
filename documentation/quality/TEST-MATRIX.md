# Test Matrix (MVP)

Status date: 2026-02-07

## Required Gates

- `pnpm nx run-many --target=test --all`
- `pnpm nx run docs-policy:check`
- `pnpm nx run mvp-gates:e2e`

## Unit/Integration Focus

- Shared models contracts
- API auth/post/revision behavior (Jest)
- Web app component/service behavior (Vitest)
- Viewer tile prefetch/cache service behavior (Vitest)
- Auth UX flows via Playwright MVP suite

## Deferred Test Areas

- Mode B visual parity tests (v2)
- Nest <-> Go contract tests (v2)
- FITS proxy compliance tests (v2)
