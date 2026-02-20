# Hardening Plan

Status date: 2026-02-20
Owner: Cosmic Horizons engineering

## Objective

Resolve high-credibility architecture, security, and operations gaps that are likely to be questioned in interviews and technical reviews.

## Scope

- README and repository metadata consistency
- Correlation ID generation and propagation
- Viewer endpoint auth and abuse controls
- Session store production readiness
- Environment variable schema consolidation
- Database migration and governance maturity
- External dependency resilience documentation
- DTO validation standardization

## Phase 0: Quick Credibility Fixes (same day)

### 0.1 README badges and branch consistency

- Update `README.md` badges to current repository and `main` branch.
- Remove stale `master` references where they imply active branch naming.

Acceptance criteria:

- `README.md` badges all resolve to current repo and `main`.
- No stale badge URL points to deprecated branch.

### 0.2 Repo metadata consistency sweep

- Correct stale repo references (`cosmic-horizon` vs `cosmic-horizons`) in root-level and key operational docs.

Acceptance criteria:

- Key onboarding docs use the same canonical repository path.

## Phase 1: Correlation ID Foundation (2-3 days)

### 1.1 Request-scoped correlation context

- Add API middleware that:
  - Reads inbound `X-Correlation-Id` if present.
  - Generates a UUID when absent.
  - Stores ID in `AsyncLocalStorage`.
  - Sets response header `X-Correlation-Id`.

### 1.2 Logging integration

- Replace hardcoded correlation IDs in:
  - HTTP request logger interceptor
  - Viewer service Redis/cache logs
  - Web HTTP logger interceptor
- Read correlation ID from request context.

### 1.3 Downstream propagation

- Attach correlation headers to outbound HTTP calls:
  - SIMBAD
  - JPL Horizons
  - Cutout providers

Acceptance criteria:

- Every request has a unique correlation ID unless explicitly supplied.
- Same ID appears in API logs and downstream request headers.
- No hardcoded correlation ID remains.

## Phase 2: Viewer Endpoint Auth and Abuse Controls (2-4 days)

### 2.1 Explicit endpoint policy

- Publish endpoint matrix (public vs auth-required) for:
  - `POST /view/state`
  - `POST /view/snapshot`
  - `GET /view/cutout`
  - `GET /view/labels/nearby`

Decision required:

- Option A (recommended): auth-gate write endpoints, keep selected read endpoints public with stronger controls.
- Option B: keep all public and implement API key tiers plus stricter throttling.

### 2.2 Guard and limiter updates

- Apply selected auth guards consistently.
- Upgrade limiter from in-memory window map to Redis-backed token bucket keyed by IP + origin + route.
- Add optional API key support for higher quotas.

### 2.3 Cache and response controls

- Add explicit cache headers for expensive read routes where safe.
- Add structured abuse telemetry and alerting thresholds.

Acceptance criteria:

- Endpoint access policy is explicit in code and docs.
- Expensive endpoints have non-memory, multi-instance-safe throttling.

## Phase 3: Session Store Productionization (1-2 days)

- Replace default memory session store with Redis session store.
- Keep memory store only for local/test with explicit environment gating.
- Fail fast in production when required session backend is unavailable.

Acceptance criteria:

- Multi-instance deployments share sessions through Redis.
- No production path uses memory session store.

## Phase 4: Environment Schema Consolidation (1-2 days)

- Canonicalize Redis/env flags (`REDIS_CACHE_ENABLED`, `LOGS_REDIS_ENABLED`, session settings).
- Remove or reject ambiguous aliases like `REDIS_ENABLED` for cache behavior.
- Extend env validation rules to catch drift and legacy key usage.
- Update `.env.example` and `documentation/reference/ENV-REFERENCE.md`.
- Add CI check to fail on undocumented or conflicting env keys.

Acceptance criteria:

- One canonical key per behavior.
- CI fails when env docs and runtime schema diverge.

## Phase 5: Data Architecture Maturity (3-5 days)

### 5.1 Migration source of truth

- Add TypeORM migration workflow and Nx targets for migrate/revert/generate.
- Create baseline migration representing current schema.
- Remove runtime schema creation fallbacks from application startup.

### 5.2 Data governance artifacts

- Add ERD at repo root docs path.
- Add data dictionary with:
  - Table purpose
  - Retention policy
  - PII classification

### 5.3 Audit retention enforcement

- Implement scheduled purge job for `audit_logs` older than `AUDIT_RETENTION_DAYS`.
- Add tests for retention behavior.

Acceptance criteria:

- Schema changes are migration-driven, not startup SQL.
- Audit retention policy is enforced automatically.

## Phase 6: External Dependency Resilience Documentation (1-2 days)

- Add focused runbook for viewer/ephemeris upstreams:
  - Providers and fallback order
  - Timeout values
  - Retry/backoff behavior
  - Cache TTL rationale (including ephemeris 24h policy and cutout/labels TTLs)

Acceptance criteria:

- Resilience behavior is documented and traceable to code/config.

## Phase 7: DTO Validation Standardization (2-3 days)

- Enable global Nest `ValidationPipe` with strict settings (`whitelist`, `forbidNonWhitelisted`, transform as needed).
- Add `class-validator` decorators to DTOs across:
  - Auth
  - Viewer
  - Ephemeris
  - Core CRUD DTOs
- Replace manual query parsing with validated query DTOs where practical.

Acceptance criteria:

- Invalid payloads are rejected consistently with 4xx responses.
- Manual validation logic is minimized and deliberate.

## Phase 8: Verification, CI, and Rollout (1-2 days)

Run in CI and pre-merge:

- `pnpm nx lint cosmic-horizons-api`
- `pnpm nx test cosmic-horizons-api`
- `pnpm nx test cosmic-horizons-web`
- `pnpm nx run cosmic-horizons-api:build`
- `pnpm nx run cosmic-horizons-api:openapi`

Rollout order:

1. Phase 0
2. Phase 1
3. Phases 2-4
4. Phases 5-7
5. Phase 8 verification gate

## Deliverables Checklist

- [ ] Root README/repo metadata consistency fixed
- [ ] Correlation IDs are request-scoped and propagated end-to-end
- [ ] Viewer endpoint auth/abuse policy documented and implemented
- [ ] Redis-backed session store in production path
- [ ] Canonical env schema + CI drift enforcement
- [ ] TypeORM migrations operational and used as source of truth
- [ ] ERD + data dictionary published
- [ ] Audit log retention job active
- [ ] Upstream resilience runbook published
- [ ] Global DTO validation in place
