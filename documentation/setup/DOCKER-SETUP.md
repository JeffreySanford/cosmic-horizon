# Docker Setup Guide

Status date: 2026-02-07

## Overview

VLASS Portal local infra uses Docker Compose for:

- PostgreSQL 16 (`vlass-postgres`)
- Redis 7 (`vlass-redis`)

Compose file: `docker-compose.yml`.

## Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine + Compose
- Ports available:
  - Postgres: `15432` (default)
  - Redis: `6379` (default)

## Recommended Startup Flow

From repository root:

```bash
pnpm start:all
```

This runs:

1. `pnpm run start:ports:free`
2. `pnpm run start:infra`
3. `pnpm nx run-many --target=serve --projects=vlass-web,vlass-api --parallel=2`

`start:infra` runs:

```bash
pnpm run start:infra:check && docker compose down --remove-orphans --volumes && docker compose build --pull && docker compose up -d --wait
```

This guarantees stale containers/volumes are rebuilt and services are healthy before app startup.

## Manual Infra Commands

```bash
# Start infra only
pnpm run start:infra

# Stop/remove containers and volumes
docker compose down --remove-orphans --volumes

# Check status
docker compose ps

# Follow logs
docker compose logs -f
```

## Default Local Credentials

From `docker-compose.yml` defaults:

- `DB_USER=vlass_user`
- `DB_PASSWORD=vlass_password_dev`
- `DB_NAME=vlass_portal`
- `DB_PORT=15432`
- `REDIS_PASSWORD=vlass_redis_dev`
- `REDIS_PORT=6379`

## App Environment Variables

API resolves `.env.local` / `.env` first (non-production), then process env.

Key DB/API vars:

- `API_PORT` (default `3000`)
- `FRONTEND_URL` (default `http://localhost:4200`)
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (default `7d`)
- `SESSION_SECRET`
- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `15432`)
- `DB_USER` (default `vlass_user`)
- `DB_PASSWORD` (default `vlass_password_dev`)
- `DB_NAME` (default `vlass_portal`)

Optional cutout reliability vars:

- `CUTOUT_FETCH_TIMEOUT_MS` (default `25000`)
- `CUTOUT_CACHE_TTL_MS` (default `300000`)
- `CUTOUT_SECONDARY_ENABLED` (`true` enables secondary keyed fallback)
- `CUTOUT_SECONDARY_URL_TEMPLATE`
  - placeholders supported: `{ra}`, `{dec}`, `{fov}`, `{fov_rad}`, `{survey}`, `{width}`, `{height}`
- `CUTOUT_SECONDARY_TIMEOUT_MS`
- `CUTOUT_SECONDARY_API_KEY`
- `CUTOUT_SECONDARY_API_KEY_HEADER` (default `Authorization`)
- `CUTOUT_SECONDARY_API_KEY_PREFIX` (default `Bearer`)
- `CUTOUT_SECONDARY_API_KEY_QUERY_PARAM`

## Health and Troubleshooting

### Docker daemon not running

`start:infra:check` will fail fast and attempt to launch Docker Desktop on Windows.

### Port conflicts (3000/4200)

Use:

```bash
pnpm run start:ports:free
```

### Database auth failures

Most common cause is stale volumes with old credentials. Reset infra:

```bash
docker compose down --remove-orphans --volumes
pnpm run start:infra
```

### Validate Postgres connectivity

```bash
docker compose exec vlass-postgres psql -U vlass_user -d vlass_portal
```

## Related Docs

- `documentation/setup/DOCKER-BOOTSTRAP.md`
- `documentation/operations/QUICK-START.md`
- `documentation/operations/ENVIRONMENT-CONFIG.md`
