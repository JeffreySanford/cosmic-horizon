# API Routes (MVP Aligned)

Status date: 2026-02-08
Canonical scope: `documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## MVP Route Groups

### Auth

- `POST /api/auth/register`

- `POST /api/auth/login`

- `POST /api/auth/refresh`

- `GET /api/auth/login` (GitHub OAuth redirect)

- `GET /api/auth/github/callback`

- `GET /api/auth/me`

- `GET /api/auth/csrf-token`

- `POST /api/auth/logout`

### Viewer (Mode A / Aladin)

- `POST /api/view/state` (persist encoded viewer state + short permalink ID)

- `GET /api/view/:shortId` (resolve permalink state, including center labels)

- `POST /api/view/snapshot` (store PNG snapshot metadata + artifact file; write-path rate limited + audited)

- `GET /api/view/snapshots/:fileName` (static snapshot artifact path)

- `GET /api/view/cutout?ra&dec&fov&survey[&label]` (stream FITS science cutout attachment with provider retries/fallbacks, rate limit, and audit event)

- `GET /api/view/labels/nearby?ra&dec&radius[&limit]` (catalog labels around current center; read-path rate limited)

- `GET /api/view/telemetry` (admin-only telemetry endpoint; authenticated + role gated)

### Community Posts

- `GET /api/posts`

- `GET /api/posts/published`

- `POST /api/posts`

- `GET /api/posts/:id`

- `PUT /api/posts/:id`

- `POST /api/posts/:id/publish`

- `POST /api/posts/:id/unpublish`

- `DELETE /api/posts/:id`

### Moderation (Posts)

- `POST /api/posts/:id/hide`

- `POST /api/posts/:id/unhide`

- `POST /api/posts/:id/lock`

- `POST /api/posts/:id/unlock`

### Ops

- `GET /api`

- `GET /api/health`

- `GET /api/users`

- `POST /api/users`

- `GET /api/users/:id`

- `PUT /api/users/:id`

- `DELETE /api/users/:id`

- `GET /api/users/:userId/posts`

## Explicitly Deferred Routes

- Email verification endpoint (`/api/auth/verify-email`) - deferred

- Comment endpoints (`/community/posts/:id/comments`) - v1.1

- Mode B/manifest routes - v2

- Advanced FITS proxy/caching routes - v2

## Source of Truth Models

API payloads must align with DTOs defined in `libs/shared/models`.
## If docs and DTOs conflict, DTOs + charter/scope-lock win
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
