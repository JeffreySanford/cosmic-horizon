# VLASS Portal

[![Build](https://github.com/JeffreySanford/vlass-portal/actions/workflows/build.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/vlass-portal/actions/workflows/build.yml)
[![Unit Tests](https://github.com/JeffreySanford/vlass-portal/actions/workflows/unit-tests.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/vlass-portal/actions/workflows/unit-tests.yml)
[![E2E](https://github.com/JeffreySanford/vlass-portal/actions/workflows/e2e.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/vlass-portal/actions/workflows/e2e.yml)
[![Lint](https://github.com/JeffreySanford/vlass-portal/actions/workflows/lint.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/vlass-portal/actions/workflows/lint.yml)
[![CodeQL](https://github.com/JeffreySanford/vlass-portal/actions/workflows/codeql.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/vlass-portal/actions/workflows/codeql.yml)

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
pnpm start:all
pnpm test
pnpm build
```

## Commands (Nx-first with pnpm wrappers)

```bash
pnpm start:web      # nx serve vlass-web
pnpm start:api      # nx serve vlass-api
pnpm start:all      # free ports + docker infra + web/api serve
pnpm test           # nx run-many --target=test --all
pnpm test:web       # nx test vlass-web
pnpm test:api       # nx test vlass-api
pnpm e2e:mvp        # nx run mvp-gates:e2e
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

## Release Quality Gates

```bash
pnpm nx run docs-policy:check
pnpm nx run-many --target=test --all
pnpm nx run mvp-gates:e2e
```

## Key Docs

- `documentation/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`
- `documentation/STATUS.md`
- `documentation/ENV.md`
- `documentation/DEMO.md`
- `documentation/TESTING-STRATEGY.md`
- `documentation/ROADMAP.md`
- `TODO.md`
