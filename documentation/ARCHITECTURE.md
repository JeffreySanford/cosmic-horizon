# Architecture (MVP)

Status date: 2026-02-07

Canonical scope is defined by:
- `documentation/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`

## Components
- Frontend: `apps/vlass-web` (Angular SSR)
- Backend: `apps/vlass-api` (NestJS + Postgres/Redis)
- Shared models: `libs/shared/models`

```mermaid
flowchart LR
    U[Browser Client] --> W[Angular SSR Web<br/>apps/vlass-web]
    W --> A[NestJS API<br/>apps/vlass-api]
    A --> P[(PostgreSQL)]
    A --> R[(Redis)]
    W --> V[Aladin HiPS Viewer]
    V --> E[External VLASS/HiPS Sources]
```

Frontend runtime note:
- Mode A viewer includes short-lived client-side HiPS tile prefetch/cache (window-scoped, TTL/LRU bounded) for UX performance only.

## Boundaries
- Browser does not directly own policy decisions.
- NestJS enforces auth, RBAC, auditing, and rate limits.
- Viewer is Mode A only (Aladin) for MVP.
- SSR is the user entry path; API remains the policy and data control plane.

## Data Policy
- Public VLASS usage only.
- FITS is link-out only.
- No mirror-like proxy in MVP.
- Viewer tile prefetch is transient and non-mirroring (not persisted, bounded by policy).

## Rust and Go Decision
- Go microservice is removed from MVP.
- Rust rendering is optional and deferred.
- Because Mode B is deferred, no heavy rendering tier is required for MVP success.
- Re-introduce a render service only if one of these triggers occurs:
  1. Snapshot generation cannot meet quality/performance targets in Node/client path.
  2. SSR preview generation becomes CPU-bound in production.
  3. v2 Mode B is approved.
