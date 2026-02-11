# User Verification & Authentication (MVP)

Status date: 2026-02-07
Canonical scope: `documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## Current Auth States

- Anonymous: read-only access

- Authenticated: JWT-backed API access with session-compatible routes

## MVP Unlocks

- Credential registration and login (`/api/auth/register`, `/api/auth/login`)

- Token issuance (`Bearer`) and authenticated write-path protection

- Role propagation in auth payload (`user.role`) for route-level RBAC checks

- Backend role verification for admin routes via `GET /api/auth/me` (JWT-protected)

- Frontend auth interceptor adds `Authorization: Bearer <token>` to authenticated API requests

- Session-compatible GitHub OAuth endpoints retained

## Deferred Unlocks

- Email verification workflow (deferred; route not implemented)

- Comments/replies (v1.1)

- FITS proxy access paths (v2)

## Route Surface

- `POST /api/auth/register`

- `POST /api/auth/login`

- `GET /api/auth/me`

- `POST /api/auth/logout`

- `GET /api/auth/login`

- `GET /api/auth/github/callback`

All auth DTOs should align to contracts in `libs/shared/models`.

## Required Runtime Secrets

- `JWT_SECRET` must be set for API startup (non-test).

- `SESSION_SECRET` must be set for API startup (non-test).

- Missing secrets now fail fast at boot to prevent weak default-key deployments.

## Local Seed Accounts

Loaded from `documentation/database/init.sql` (see `documentation/database/SEEDING-OPERATIONS.md`):

- Standard user

  - Email: `test@vlass.local`

  - Password: `Password123!`

  - Role: `user`

- Admin user

  - Email: `admin@vlass.local`

  - Password: `AdminPassword123!`

  - Role: `admin`

## Password Handling

- Passwords are transmitted only for `POST /api/auth/login` and `POST /api/auth/register`.

- After authentication, client->backend communication uses JWT Bearer tokens.

- Role checks for admin pages are backend-validated using `/api/auth/me`, not trusted from local storage alone.

## Auth Event Logging

- Frontend app logger records `login_submit`, `login_success`, `login_failed`, `register_submit`, `register_success`, `register_failed`, `logout_requested`, `logout_success`, and `logout_failed`.

## - Backend audit logs record successful login/logout events (`AuditAction.LOGIN`, `AuditAction.LOGOUT`) with request IP/user-agent metadata when available
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
