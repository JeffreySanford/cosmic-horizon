# Cache Policy (MVP)

Status date: 2026-02-07

## Scope

MVP cache layers:

- Browser cache for static assets
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
