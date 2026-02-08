# Environment Variables

This project keeps committed env configuration in `.env.example` only.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in real local values.
3. Never commit `.env.local`.

## Required Variables

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `API_PORT`
- `API_PREFIX`
- `NODE_ENV`
- `FRONTEND_PORT`
- `FRONTEND_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `VLASS_API_BASE_URL`
- `VLASS_API_TIMEOUT`
- `AUDIT_RETENTION_DAYS`
- `REDIS_CACHE_TTL`

## Optional Runtime Flags

- `ENABLE_CSRF_PROTECTION`
- `CUTOUT_FETCH_TIMEOUT_MS`
- `CUTOUT_CACHE_TTL_MS`
- `CUTOUT_SECONDARY_ENABLED`
- `CUTOUT_SECONDARY_URL_TEMPLATE`
- `CUTOUT_SECONDARY_TIMEOUT_MS`
- `CUTOUT_SECONDARY_API_KEY`
- `CUTOUT_SECONDARY_API_KEY_HEADER`
- `CUTOUT_SECONDARY_API_KEY_PREFIX`
- `CUTOUT_SECONDARY_API_KEY_QUERY_PARAM`

## Security Rules

- Treat `JWT_SECRET`, `SESSION_SECRET`, OAuth secrets, and DB credentials as secrets.
- Rotate secrets immediately if they are committed.
- Use GitHub secret scanning and push protection on this repository.
