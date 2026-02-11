# API Datastore Security Audit (PostgreSQL + Redis)

Date: 2026-02-08  
Scope: `apps/vlass-api` runtime + datastore integration + local infra compose defaults.

## Executive Summary

- Security posture improved with targeted hardening for datastore paths.
- High-risk exposure reduced by limiting telemetry access, adding rate limits, and tightening transport/config checks.
- Remaining risks are documented below for follow-up.

## Findings And Actions

### 1) Telemetry endpoint exposed operational internals

- Risk: `GET /api/view/telemetry` was publicly reachable.
- Fix: restricted telemetry to authenticated admin users only.
- Files:
  - `apps/vlass-api/src/app/viewer/viewer.controller.ts`
  - `apps/vlass-api/src/app/viewer/viewer.controller.spec.ts`

### 2) Missing abuse control on viewer state and label lookup

- Risk: high-volume state creation and nearby-label queries could be abused for DB/upstream load.
- Fix: added `RateLimitGuard` to:
  - `POST /api/view/state`
  - `GET /api/view/labels/nearby`
- Added dedicated nearby-label rate limit knob:
  - `RATE_LIMIT_MAX_NEARBY_LABELS` (default `24` / window)
- Files:
  - `apps/vlass-api/src/app/viewer/viewer.controller.ts`
  - `apps/vlass-api/src/app/guards/rate-limit.guard.ts`
  - `apps/vlass-api/src/app/guards/rate-limit.guard.spec.ts`

### 3) Redis connection hardening gaps

- Risk: cache layer could run without password in production/required mode; no TLS toggle.
- Fix:
  - Added optional TLS support (`REDIS_TLS_ENABLED`, `REDIS_TLS_REJECT_UNAUTHORIZED`).
  - Enforced password requirement when `NODE_ENV=production` or `REDIS_REQUIRE_PASSWORD=true`.
  - If insecurely configured, Redis cache is disabled with warning instead of connecting.
- File:
  - `apps/vlass-api/src/app/viewer/viewer.service.ts`

### 4) Potential secret leakage via telemetry failure reasons

- Risk: provider error text could include query params (`api_key`, `token`) and surface in telemetry.
- Fix: redaction + truncation of failure reasons before telemetry storage/return.
- File:
  - `apps/vlass-api/src/app/viewer/viewer.service.ts`

### 5) Postgres logging in production can leak sensitive query params

- Risk: enabling `DB_LOGGING=true` in production can log sensitive values (including auth query params).
- Fix:
  - Production startup now blocks `DB_LOGGING=true` unless explicitly overridden with `DB_ALLOW_SENSITIVE_LOGGING=true`.
  - `DB_PASSWORD` treated as required for database config.
- File:
  - `apps/vlass-api/src/app/database.config.ts`

### 6) Local container port exposure wider than needed

- Risk: Redis/Postgres ports were bound to all interfaces.
- Fix: bind to localhost only in compose.
- File:
  - `docker-compose.yml`

## Recommended Environment Baseline

- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=true`
- `DB_LOGGING=false`
- `REDIS_CACHE_ENABLED=true`
- `REDIS_PASSWORD=<strong-secret>`
- `REDIS_REQUIRE_PASSWORD=true`
- `REDIS_TLS_ENABLED=true` (if Redis supports TLS)
- `REDIS_TLS_REJECT_UNAUTHORIZED=true`

## Remaining Follow-ups

- Add mTLS / managed Redis with TLS cert pinning for non-local environments.
- Move session storage from memory to Redis-backed store for multi-instance deployments.
- Add network policy/firewall enforcement for datastore ports in non-local environments.
- Add CI policy checks for insecure env combinations.
