# VLASS Portal

Canonical MVP docs:

- `documentation/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`

If any other doc conflicts, treat those two as source of truth.

## MVP Summary

VLASS Portal MVP is a three-pillar Angular + NestJS product:

1. SSR first paint (<1s target on 4G)
2. Aladin viewer + permalink + snapshots
3. Community notebook posts with revisions

Deferred to v1.1/v2: comments, Mode B, FITS proxy, Go microservice.

## Quick Start

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Commands (Nx-first with pnpm wrappers)

```bash
pnpm dev:web        # nx serve vlass-web
pnpm dev:api        # nx serve vlass-api
pnpm test           # nx run-many --target=test --all
pnpm test:web       # nx test vlass-web
pnpm test:api       # nx test vlass-api
pnpm build          # nx run-many --target=build --all
pnpm lint           # nx run-many --target=lint --all
```

## Projects

- `apps/vlass-web` - Angular SSR frontend
- `apps/vlass-api` - NestJS backend
- `apps/vlass-web-e2e` - Playwright E2E
- `apps/vlass-api-e2e` - API E2E
- `libs/shared/models` - Shared types

## Baseline Gate

```bash
pnpm nx run-many --target=test --all
```

## Key Docs

- `documentation/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`
- `documentation/STATUS.md`
- `documentation/TESTING-STRATEGY.md`
- `documentation/ROADMAP.md`
- `TODO.md`
