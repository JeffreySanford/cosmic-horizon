# Environment Variables Reference

Complete reference of all environment variables used by Cosmic Horizons.

## Database

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `DB_TYPE` | string | `postgres` | No | Database system (always postgres) |
| `DB_HOST` | string | `localhost` | Yes | PostgreSQL hostname |
| `DB_PORT` | number | `5432` | No | PostgreSQL port |
| `DB_USERNAME` | string | `postgres` | Yes | Database user |
| `DB_PASSWORD` | string | `postgres` | Yes | Database password (SENSITIVE) |
| `DB_DATABASE` | string | `cosmic_horizons` | No | Database name |

## Redis

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `REDIS_HOST` | string | `localhost` | Yes | Redis hostname |
| `REDIS_PORT` | number | `6379` | No | Redis port |
| `REDIS_PASSWORD` | string | (empty) | No | Redis password (SENSITIVE) |
| `REDIS_DB` | number | `0` | No | Redis database number |

## Server

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `NODE_ENV` | string | `development` | No | Application environment |
| `PORT` | number | `3000` | No | API server port |
| `SERVER_HOST` | string | `0.0.0.0` | No | API server bind address |
| `FRONTEND_PORT` | number | `4200` | No | Frontend dev server port |
| `FRONTEND_URL` | string | `http://localhost:4200` | Yes | Frontend public URL |

## Authentication

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `JWT_SECRET` | string | (dev-default) | Yes | JWT signing key (min 32 chars, SENSITIVE) |
| `JWT_EXPIRES_IN` | string | `7d` | No | JWT token expiration |
| `SESSION_SECRET` | string | (dev-default) | Yes | Express session secret (SENSITIVE) |

## GitHub OAuth

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `GITHUB_CLIENT_ID` | string | (none) | No | OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | string | (none) | No | OAuth app client secret (SENSITIVE) |
| `GITHUB_CALLBACK_URL` | string | `http://localhost:3000/api/auth/github/callback` | No | OAuth callback endpoint |

## Logging

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `LOG_LEVEL` | string | `info` | No | Logging level (debug/info/warn/error) |
| `LOGS_REDIS_ENABLED` | boolean | `false` | No | Enable Redis-based audit logging |
| `AUDIT_RETENTION_DAYS` | number | `90` | No | Retention period for audit logs |

## Features

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `EPHEMERIS_ENABLED` | boolean | `true` | No | Enable ephemeris search feature |
| `EPHEMERIS_CACHE_ENABLED` | boolean | `true` | No | Enable ephemeris result caching |
| `EPHEMERIS_CACHE_TTL_HOURS` | number | `24` | No | Ephemeris cache time-to-live |
| `COMMENTS_ENABLED` | boolean | `true` | No | Enable comments/threading feature |
| `JOBS_ENABLED` | boolean | `true` | No | Enable remote jobs/TACC feature |

## Application Info

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `APP_VERSION` | string | `1.1.1` | No | Application version |
| `APP_NAME` | string | `Cosmic Horizons API` | No | Application display name |

## Development-Only

| Variable | Type | Default | Required | Usage |
|----------|------|---------|----------|-------|
| `cosmic-horizons_API_BASE_URL` | string | `https://api.cosmic-horizons.org` | No | Cosmic Horizons data API base |
| `cosmic-horizons_API_TIMEOUT` | number | `30000` | No | API timeout in milliseconds |

## Examples

### Local Development (.env.local)

```dotenv
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:4200
JWT_SECRET=dev-secret-min-32-chars-long-change-this
SESSION_SECRET=dev-session-secret
LOG_LEVEL=info
```

### GitHub Actions (.secrets.env via CI)

``` text
DB_PASSWORD=${{ secrets.DB_PASSWORD }}
JWT_SECRET=${{ secrets.JWT_SECRET }} (min 32 chars)
SESSION_SECRET=${{ secrets.SESSION_SECRET }}
GITHUB_CLIENT_SECRET=${{ secrets.GITHUB_CLIENT_SECRET }}
REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }}
```

### Production Deployment

```bash
export NODE_ENV=production
export DB_HOST=prod-database.example.com
export DB_PASSWORD=<secure-password-from-vault>
export JWT_SECRET=<32-char-minimum-from-vault>
export SESSION_SECRET=<from-vault>
export REDDIT_PASSWORD=<from-vault>
export FRONTEND_URL=https://cosmichorizons.org
```

## Validation Rules

### Development (`NODE_ENV=development`)

- Missing non-critical values use hardcoded defaults
- Dev-friendly defaults allow quick startup
- Allows testing with minimal configuration

### Production (`NODE_ENV=production`)

- All sensitive values MUST be set via environment variables
- Missing values cause immediate startup failure
- No fallback to defaults
- Validation occurs before app starts

## Security Best Practices

1. **Never** commit .env files with real values
2. **Never** log or print JWT_SECRET or SESSION_SECRET
3. **Always** use min 32-character secrets in production
4. **Always** rotate secrets regularly
5. **Always** use HTTPS in production
6. **Always** validate secret values on startup (production)
7. **Always** use a secrets manager in production (AWS Secrets Manager, Vault, etc.)

## Troubleshooting

### "Configuration error: app.name is required"

- Check environment config is loading correctly
- Verify environment.ts file exists

### "Missing required environment variable: JWT_SECRET"

- In development: copy .env.example to .env.local
- In production: set JWT_SECRET environment variable with min 32 chars

### "Configuration validation failed"

- Check all required environment variables are set
- See `Required` column in tables above
- Verify NODE_ENV setting (different rules for dev vs prod)
