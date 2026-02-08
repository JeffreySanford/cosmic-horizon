# Contributor Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop

## Setup

1. `pnpm install`
2. `pnpm start:all`

## Nx-First Commands

- Build: `pnpm nx run-many --target=build --all`
- Test: `pnpm nx run-many --target=test --all`
- Lint: `pnpm nx run-many --target=lint --all`
- E2E: `pnpm nx run mvp-gates:e2e`

## Documentation and Contracts

- Environment vars: `documentation/ENV.md`
- Architecture: `documentation/ARCHITECTURE.md`
- Demo path: `documentation/DEMO.md`
- API contract artifact: `documentation/api/openapi.json`

## Style and Safety

- Do not commit `.env.local`, credentials, or logs.
- Keep all changes scoped and tested.
- Prefer updating existing docs over creating conflicting copies.

## Pull Requests

1. Keep PRs focused.
2. Include test evidence (Nx command + result).
3. Update docs when behavior/config changes.
4. Ensure GitHub Actions pass.
