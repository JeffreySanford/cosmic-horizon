# API Routes (MVP Aligned)

Status date: 2026-02-07
Canonical scope: `documentation/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## MVP Route Groups

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/login` (GitHub OAuth redirect)
- `GET /api/auth/github/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Viewer (Mode A / Aladin)
- `POST /api/view/state` (persist encoded viewer state + short permalink ID)
- `GET /api/view/:shortId` (resolve permalink state)
- `POST /api/view/snapshot` (store PNG snapshot metadata + artifact file)
- `GET /api/view/snapshots/:fileName` (static snapshot artifact path)

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
- Planned for MVP pillar 3
- Not yet implemented in the current API module

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
- FITS proxy routes - v2

## Source of Truth Models
API payloads must align with DTOs defined in `libs/shared/models`.
If docs and DTOs conflict, DTOs + charter/scope-lock win.
