# Roadmap

Status date: 2026-02-07

Canonical scope: `documentation/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`.

## MVP (v1.0)
1. Pillar 1: SSR first paint
- Landing SSR preview
- Performance tuning for FCP/LCP targets

2. Pillar 2: Viewer + permalink + snapshots
- Aladin integration (Mode A only)
- Viewer state encoding/decoding
- Persistent permalink resolution
- PNG snapshot workflow

3. Pillar 3: Community notebooks
- Post create/edit/read
- Revision history and diff
- Moderation controls for posts
- Tag workflow

4. Foundations
- Auth + verification gates
- Audit logging
- Rate limiting
- CI baseline test gate

## v1.1 (Quick wins)
- Comments/replies
- Profile polish
- Feed enhancements

## v2
- Mode B canvas viewer
- FITS proxy/pass-through (policy approved)
- Optional Rust render tier for heavy compute paths

## Out of Scope for MVP
- Go microservice
- Mode B implementation
- Comments/replies
- FITS proxy/caching
