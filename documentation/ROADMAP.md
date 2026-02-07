# Roadmap

Status date: 2026-02-07

Canonical scope: `documentation/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`.

## MVP (v1.0)
1. Pillar 1: SSR first paint
- Landing SSR preview
- Performance tuning for FCP/LCP targets
- Status: complete (SSR regional preview on auth/landing, client-only telemetry overlay, gated perf tests)

2. Pillar 2: Viewer + permalink + snapshots
- Aladin integration (Mode A only)
- Viewer state encoding/decoding
- Persistent permalink resolution
- PNG snapshot workflow
- Labeling centered targets in viewer state
- FITS science cutout download path
- Status: in progress (Aladin Mode A + state/permalink/snapshot + center labels + FITS cutout endpoint shipped; remaining items listed below)

Pillar 2 remaining:
- FITS provider hardening (fallback survey mapping, retries, and provider outage messaging) - complete
- Survey-aware UX polish (native-resolution indicator at deep zoom) - complete
- Snapshot/cutout observability + policy tuning (audit entries and path-specific rate limits) - complete
- Remaining: production-level telemetry dashboards for cutout provider reliability

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
- FITS proxy/caching and advanced download controls
- Optional Rust render tier for heavy compute paths

## Out of Scope for MVP
- Go microservice
- Mode B implementation
- Comments/replies
- Full FITS proxy/caching tier (simple cutout passthrough is now available)
