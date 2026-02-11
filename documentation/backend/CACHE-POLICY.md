# Cache Policy (MVP)

Status date: 2026-02-07

## Scope

MVP cache layers:

- Browser cache for static assets

- Viewer HiPS tile runtime cache (in-memory, client-side only)

- NestJS API caching (Redis/in-memory)

- Snapshot artifact metadata storage

## Not in MVP

- Go cache layer

- Mode B tile cache strategy

- FITS proxy cache

## Rules

- Bounded TTLs only

- No mirror-like upstream storage

- Respect upstream allowlist and rate limits

## Viewer HiPS Tile Prefetch (MVP)

- Scope: current view window only; never whole-sky prefetch.

- Trigger: debounced center/zoom changes from Mode A viewer interactions.

- Strategy: prefetch nearby tile ring at current order plus immediate next order.

- Storage: in-memory LRU + short TTL (non-persistent; cleared on page/app lifecycle).

- Limits: bounded prefetch batch size and cooldown to reduce upstream pressure.

## - Policy: performance-only cache; not an archive or redistribution layer
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
