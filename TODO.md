# TODO

Status date: 2026-02-07

Canonical scope:
`documentation/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## MVP Priorities

- [ ] Keep baseline green:
  `pnpm nx run-many --target=test --all`
- [ ] Keep MVP e2e gate green:
  `pnpm nx run mvp-gates:e2e`
- [ ] Validate SSR performance targets (FCP/LCP)
- [ ] Validate permalink reliability and snapshot retention
- [ ] Complete post and revision workflows
- [ ] Complete post moderation path (hide/lock)
- [ ] Verify audit and rate limiting behavior
- [ ] Keep docs aligned with source-of-truth models

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
