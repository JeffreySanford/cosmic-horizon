# Security Hardening Review (2026-02-08)

## Scope

- API authentication/session configuration
- Web auth token handling and route protection
- Post rendering pipeline (XSS surface)
- Database TLS verification defaults

## Changes Implemented

### 1) Removed insecure auth secret fallbacks

- Added `apps/vlass-api/src/app/config/security.config.ts`.
- `JWT_SECRET` and `SESSION_SECRET` are now required in non-test environments.
- Test environment keeps deterministic fallbacks for stable test execution.

Updated files:

- `apps/vlass-api/src/main.ts`
- `apps/vlass-api/src/app/auth/auth.module.ts`
- `apps/vlass-api/src/app/auth/strategies/jwt.strategy.ts`

### 2) Removed explicit trust-bypass HTML rendering in web posts

- Removed `DomSanitizer.bypassSecurityTrustHtml(...)` from:
  - `apps/vlass-web/src/app/features/posts/post-detail.component.ts`
  - `apps/vlass-web/src/app/features/posts/post-editor.component.ts`
- Components now return plain HTML strings for Angular template sanitization at binding time.
- Added stricter markdown rendering utility:
  - `apps/vlass-web/src/app/features/posts/markdown-renderer.ts`
  - Escapes HTML, sanitizes links to safe protocols, and applies secure `rel` attributes.

### 3) Hardened DB TLS verification default

- `apps/vlass-api/src/app/database.config.ts` now uses:
  - `DB_SSL_REJECT_UNAUTHORIZED=true` by default when `DB_SSL=true`.
- This avoids insecure `rejectUnauthorized: false` defaults in secure deployments.

### 4) Short-lived access tokens + refresh-token rotation

- Access token expiry is now short-lived by default:
  - `JWT_EXPIRES_IN=15m` (default)
  - Configured in `apps/vlass-api/src/app/auth/auth.module.ts`.
- Added refresh-token rotation and revocation:
  - `apps/vlass-api/src/app/auth/auth.service.ts`
  - `apps/vlass-api/src/app/auth/dto/refresh-token.dto.ts`
  - `apps/vlass-api/src/app/auth/auth.controller.ts`
- Refresh tokens are random, stored hashed (`sha256`) in `auth_refresh_tokens`, and rotated on each `/api/auth/refresh`.
- Logout revokes both current refresh token and all user refresh tokens.

### 5) CSRF strategy for session-cookie flows (env-gated)

- Added CSRF middleware in:
  - `apps/vlass-api/src/main.ts`
- Behavior:
  - Enabled only when `ENABLE_CSRF_PROTECTION=true`.
  - Enforces `X-CSRF-Token` for unsafe methods when a session cookie is present.
  - Exempts token bootstrap endpoint: `GET /api/auth/csrf-token`.
- Adds `X-CSRF-Token` to allowed CORS headers.

### 6) Security headers with Helmet/CSP

- API helmet baseline:
  - `apps/vlass-api/src/main.ts`
- Web SSR helmet + CSP tuned for Aladin/external astronomy resources:
  - `apps/vlass-web/src/server.ts`
- CSP includes secure `script-src`, `connect-src`, and image/font directives needed by viewer integrations.
- Current Aladin requirement: `script-src` includes `'wasm-unsafe-eval'` and `'unsafe-eval'` to permit WebAssembly initialization at runtime.

### 7) Dependency vulnerability scanning in CI

- Added workspace script:
  - `package.json` -> `security:audit` (`pnpm audit --prod --audit-level=high`)
- Added CI step:
  - `.github/workflows/ci.yml` -> `pnpm run security:audit`

## Existing Security Controls Confirmed

- JWT Bearer auth for protected API routes.
- Frontend HTTP interceptor attaches bearer token for authenticated API calls.
- Backend role source-of-truth via `/api/auth/me` for admin route gating.
- Rate limiting guard on write endpoints.
- Owner checks enforced for post mutation routes.

## Remaining Recommended Follow-ups

- Add refresh-token reuse detection telemetry (detect replayed rotated refresh tokens).
- Add persistent session store (Redis-backed `express-session`) for multi-instance deployments.
- Add CSP nonces/hashes if inline script usage is reduced in SSR.
- Add periodic dependency SCA baseline report artifact retention in CI.
