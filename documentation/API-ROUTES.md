# API Routes (MVP Aligned)

Status date: 2026-02-07
Canonical scope: `documentation/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## MVP Route Groups

### Auth
- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/login`
- `POST /auth/logout`

### Config
- `GET /config/public`

### Viewer (Mode A / Aladin)
- `POST /view/state` - create persisted viewer state
- `GET /view/:shortid` - resolve shortid to viewer state
- `POST /view/snapshot` - create/record PNG snapshot metadata

### Community Posts
- `POST /community/posts`
- `GET /community/posts`
- `GET /community/posts/:id`
- `PUT /community/posts/:id` (creates new revision)
- `GET /community/posts/:id/revisions`

### Moderation (Posts)
- `PATCH /community/posts/:id/moderate` (hide/unhide/lock/unlock)

### Ops
- `GET /health`

## Explicitly Deferred Routes
- Comment endpoints (`/community/posts/:id/comments`) - v1.1
- Mode B/manifest routes - v2
- FITS proxy routes - v2

## Source of Truth Models
API payloads must align with DTOs defined in `libs/shared/models`.
If docs and DTOs conflict, DTOs + charter/scope-lock win.
