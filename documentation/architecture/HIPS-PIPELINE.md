# HiPS Pipeline (MVP)

Status date: 2026-02-07

## MVP Scope
- Aladin Mode A integration
- Public VLASS HiPS layers
- Fast SSR preview support
- Client-side window-scoped HiPS tile prefetch/cache for smoother pan/zoom

## Deferred
- Mode B WCS/reprojection pipeline (v2)
- FITS pass-through/proxy behavior (v2)

## Policy
Upstream access remains bounded and non-mirroring.

### Runtime Tile Prefetch Constraints (MVP)
- Prefetch is debounced from viewer movement events.
- Only neighboring tiles around the current field are requested.
- Prefetch includes current tile order and one deeper order for near-term zoom.
- Cache is transient in-memory (TTL + LRU), not persisted to disk.
- Requests are capped and cooled down to avoid burst behavior.
