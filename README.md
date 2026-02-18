# Cosmic Horizon

> Independent portal using public VLASS data; not affiliated with VLA/NRAO.
> Built and operated as an independent project by Jeffrey Sanford.

[![Build](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/build.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/build.yml)
[![Unit Tests](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/unit-tests.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/unit-tests.yml)
[![E2E](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/e2e.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/e2e.yml)
[![Lint](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/lint.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/lint.yml)
[![CodeQL](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/codeql.yml/badge.svg?branch=master)](https://github.com/JeffreySanford/cosmic-horizons/actions/workflows/codeql.yml)

Canonical MVP docs:

- `documentation/product/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`
- `documentation/index/OVERVIEW-V2.md`

If any other doc conflicts, treat `PRODUCT-CHARTER.md` + `SCOPE-LOCK.md` as source of truth.

Strategic AI control-plane direction:

- `AGENTS.md` (`CosmicAI Docking & AI Control Plane`)
- `documentation/planning/roadmap/ROADMAP.md` (Phase planning consolidated)
- `documentation/marketing/scope/COSMIC-HORIZONS-2026-SCOPE.md`

Strategic documents inform planning and integration direction, but do not override MVP scope locks.

## MVP Summary

Cosmic Horizon MVP is a three-pillar Angular + NestJS product:

1. SSR first paint (<1s target on 4G)
2. Aladin viewer + permalink + snapshots
3. Community notebook posts with revisions

**v1.1 Additions (Complete)**:

- **Threaded Comments**: Recursive community engagement on notebook posts.
- **Scientific Ephemeris**: High-precision planetary/minor-planet coordinate resolution via `/ephem` route.
  - Supports Mars, Venus, Sun, Moon with astronomy-engine backend
  - Redis caching (24h TTL) for performance
  - RA/Dec coordinates with accuracy metrics
- **Community Discoveries (prototype)**: persisted `Community Feed` (Postgres + TypeORM), seeded dev data, `community.discovery.created` notification events, and unit + e2e tests (backend + RabbitMQ notification assertion).

**v1.2 Additions (In Progress)**:

- **Remote Compute Gateway**: TACC/CosmicAI Job Orchestration spike and symposium artifacts.

Deferred to v2+: Mode B, FITS proxy, Go microservice.

## Quick Start

```bash
pnpm install
pnpm start:all
pnpm test
pnpm build
```

## Commands (Nx-first with pnpm wrappers)

```bash
pnpm start:web      # nx serve cosmic-horizons-web
pnpm start:api      # nx serve cosmic-horizons-api
pnpm start:all      # free ports + start infra (no teardown) + web/api serve
pnpm start:all:reset # full infra reset (down --volumes + rebuild) + web/api serve
pnpm test           # nx run-many --target=test --all
pnpm test:web       # nx test cosmic-horizons-web
pnpm test:api       # nx test cosmic-horizons-api
pnpm e2e:mvp        # nx run mvp-gates:e2e
pnpm lighthouse:mobile # lhci mobile audit
pnpm lighthouse:summary # text/json summary for CI + AI consumers
pnpm build          # nx run-many --target=build --all
pnpm lint           # nx run-many --target=lint --all
```

## Projects

- `apps/cosmic-horizons-web` - Angular SSR frontend (landing, posts, ephemeris page, moderation dashboard)
- `apps/cosmic-horizons-api` - NestJS backend (auth, posts, comments, ephemeris, jobs)
- `apps/cosmic-horizons-web-e2e` - Playwright E2E
- `apps/cosmic-horizons-api-e2e` - API E2E
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

- `documentation/product/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`
- `AGENTS.md`
- `documentation/governance/STATUS.md`
- `documentation/governance/SOURCE-OF-TRUTH.md`
- `documentation/product/AFFILIATION.md`
- `documentation/governance/EXTERNAL-RESEARCH-WORKFLOW.md`
- `documentation/operations/ENV.md`
- `documentation/operations/DEMO.md`
- `documentation/index/OVERVIEW-V2.md`
- `documentation/quality/TESTING-STRATEGY.md`
- `documentation/planning/roadmap/ROADMAP.md`
- `documentation/planning/INDUSTRY-CONTEXT-AND-FEASIBILITY-2026-02-11.md`
- `TODO.md`
