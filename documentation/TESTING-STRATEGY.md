# Testing Strategy (MVP)

Status date: 2026-02-07

## Scope

This strategy covers in-scope MVP architecture only:

- Angular SSR web app
- NestJS API
- Shared models library

## Baseline Gate (Required)

```bash
pnpm nx run-many --target=test --all
```

CI must fail on baseline gate failures.

## Test Layers

1. Unit tests

- API services/controllers
- Web components/services
- shared models

1. Integration tests

- API module interactions and DB-backed behavior

1. E2E tests

- Web critical flows
- API e2e scenarios

## Deferred Test Work (Not MVP)

- Nest <-> Go contract tests
- Mode B golden image tests
- FITS proxy compliance tests

## Quality Policy

- Every merge must keep baseline tests green.
- New behavior should include tests in the closest relevant layer.
