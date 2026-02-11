# Environment Configuration (MVP)

Status date: 2026-02-07

## Principles

- Server-only secrets stay in API environment variables.

- Web client currently uses fixed local API base URL (`http://localhost:3000`) in dev.

- Public cutout endpoints are the default. Optional keyed secondary cutout provider is supported via API env vars.

## Required Core Variables

- `NODE_ENV`

- `API_PORT`

- `JWT_SECRET`

- `JWT_EXPIRES_IN`

- `SESSION_SECRET`

- `FRONTEND_URL`

- `DB_HOST`

- `DB_PORT`

- `DB_USER`

- `DB_PASSWORD`

- `DB_NAME`

- `DB_SSL`

- `DB_LOGGING`

## Deferred Feature Flags

- Mode B toggles (v2)

- FITS proxy toggles (v2)

- Comment feature flags (v1.1)

## Optional Cutout Provider Variables

- `CUTOUT_FETCH_TIMEOUT_MS` (default `25000`)

- `CUTOUT_CACHE_TTL_MS` (default `300000`)

- `CUTOUT_SECONDARY_ENABLED` (`true` to enable secondary provider fallback)

- `CUTOUT_SECONDARY_URL_TEMPLATE`

  - URL template with placeholders:

    `{ra}`, `{dec}`, `{fov}`, `{fov_rad}`, `{survey}`, `{width}`, `{height}`

- `CUTOUT_SECONDARY_TIMEOUT_MS` (optional override for secondary requests)

- `CUTOUT_SECONDARY_API_KEY` (optional)

- `CUTOUT_SECONDARY_API_KEY_HEADER` (default `Authorization`)

- `CUTOUT_SECONDARY_API_KEY_PREFIX` (default `Bearer`)

- `CUTOUT_SECONDARY_API_KEY_QUERY_PARAM` (optional query parameter name for key pass-through)

Example:

```env
CUTOUT_SECONDARY_ENABLED=true
CUTOUT_SECONDARY_URL_TEMPLATE=https://example.org/cutout?ra={ra}&dec={dec}&fov={fov}&survey={survey}&width={width}&height={height}
CUTOUT_SECONDARY_API_KEY=replace_me
CUTOUT_SECONDARY_API_KEY_HEADER=X-API-Key
CUTOUT_SECONDARY_API_KEY_PREFIX=

```

## If config docs conflict with runtime code, source of truth is active code + charter/scope lock
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
