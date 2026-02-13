# Environment Configuration Guide

## Overview

Cosmic Horizons uses a **tiered environment configuration system** that separates non-sensitive defaults from sensitive local overrides:

1. **environment.ts / environment.prod.ts** - Shared defaults (git-tracked)
2. **.env.example** - Reference configuration with seeded users (git-tracked)
3. **.env.local** - Local overrides (git-ignored, never committed)
4. **Environment variables** - CI/CD and runtime overrides (highest priority)

## For Developers

### Quick Start

1. **Copy .env.example to .env.local:**

   ```bash
   cp apps/cosmic-horizons-api/.env.example apps/cosmic-horizons-api/.env.local
   ```

2. **Update only sensitive values in .env.local:**
   - GitHub OAuth credentials (if testing OAuth)
   - JWT secrets (if different from dev defaults)
   - Database credentials (if not using defaults)
   - Redis password (if configured)

3. **Start the application:**

   ```bash
   pnpm start:all
   ```

### Test Users

The following users are automatically seeded in the database on initialization:

| Username | Email | Password | Role | Usage |
|----------|-------|----------|------|-------|
| testuser | <test@cosmic.local> | Password123! | user | Standard user testing |
| adminuser | <admin@cosmic.local> | AdminPassword123! | admin | Admin features testing |
| admin | <admin-direct@cosmic.local> | AdminPassword123! | admin | Admin convenience alias |

**Login URL:** <http://localhost:4200/auth/login>

**Important:** Use email addresses to login, not usernames.

### Configuration File Usage

#### .env.example (Shared, git-tracked)

```dotenv
# Non-sensitive defaults everyone needs
DB_HOST=localhost
DB_PORT=5432
FRONTEND_URL=http://localhost:4200
LOG_LEVEL=info

# Placeholders for sensitive data
GITHUB_CLIENT_ID=your_github_client_id
JWT_SECRET=your_jwt_secret_key_min_32_chars_long_change_this
```

#### .env.local (Local overrides, git-ignored)

```dotenv
# Copy from .env.example and update sensitive values:

# Real GitHub OAuth (if testing OAuth)
GITHUB_CLIENT_ID=your_real_client_id_here
GITHUB_CLIENT_SECRET=your_real_client_secret_here

# Production-grade secrets (if testing)
JWT_SECRET=your-production-secret-min-32-characters-long-here
SESSION_SECRET=your-production-session-secret-here
```

## For GitHub Actions / CI

GitHub Actions and CI pipelines use **environment variables** set in GitHub Secrets:

1. Go to: **Repository Settings → Secrets and variables → Actions**
2. Add required secrets:
   - `DB_PASSWORD` - Database password
   - `JWT_SECRET` - JWT signing key (min 32 chars)
   - `SESSION_SECRET` - Express session secret
   - `GITHUB_CLIENT_ID` - OAuth client ID
   - `GITHUB_CLIENT_SECRET` - OAuth client secret
   - `REDIS_PASSWORD` - Redis password (if configured)

3. Workflow file uses these directly:

   ```yaml
   env:
     DB_HOST: localhost
     DB_PORT: 5432
     # Sensitive values come from secrets
     DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
     JWT_SECRET: ${{ secrets.JWT_SECRET }}
   ```

## Configuration Fallback Precedence

Values are loaded in this order (first match wins):

1. Environment variables (CI/runtime highest priority)
2. .env.local file (local overrides)
3. .env.example file (shared defaults)
4. environment.ts / environment.prod.ts hardcoded defaults
5. Error if required value missing (production only)

Example for `DB_PASSWORD`:

- If `$DB_PASSWORD` env var exists → use that
- Else if `.env.local` has `DB_PASSWORD` → use that
- Else if `.env.example` has `DB_PASSWORD` → use that
- Else use hardcoded default from environment.ts → use that
- If production and no value → throw error

## Sensitive vs Non-Sensitive

### Non-Sensitive (can stay in .env.example, git-tracked)

- `DB_HOST`, `DB_PORT` (host/port are public info)
- `REDIS_HOST`, `REDIS_PORT`
- `API_PORT`, `FRONTEND_URL`
- `NODE_ENV`, `LOG_LEVEL`
- `FRONTEND_URL` (public callback endpoint)
- OAuth callback URL structure (without secret)

### Sensitive (MUST go in .env.local or CI secrets, never committed)

- `DB_PASSWORD` - Database authentication
- `JWT_SECRET` - Token signing key
- `SESSION_SECRET` - Session authentication
- `GITHUB_CLIENT_SECRET` - OAuth secret
- `REDIS_PASSWORD` - Redis authentication

## Troubleshooting

### Problem: "Missing required environment variable: JWT_SECRET"

**Solution:**

- Copy .env.example to .env.local: `cp .env.example .env.local`
- Update JWT_SECRET in .env.local to a 32+ character string

### Problem: Database connection fails

**Check:**

1. - `DB_HOST` matches your postgres container
2. - `DB_PORT` matches postgres port (usually 5432)
3. - `DB_USERNAME` and `DB_PASSWORD` match container startup
4. - PostgreSQL container is running: `docker ps | grep postgres`

### Problem: Tests fail on GitHub Actions

**Check:**

1. Repository Secrets are configured (Settings → Secrets and variables)
2. Workflow file has correct secret references: `${{ secrets.SECRET_NAME }}`
3. All required secrets are set (check Actions tab for error logs)

## For Production Deployment

1. **All sensitive values via environment variables:**

   ```bash
   export DB_PASSWORD="your-secure-password"
   export JWT_SECRET="your-32-char-minimum-secret-key"
   export SESSION_SECRET="your-session-secret"
   export GITHUB_CLIENT_SECRET="your-oauth-secret"
   # etc.
   ```

2. **Production environment.prod.ts validates all required values:**
   - Missing secrets will cause immediate startup failure
   - No fallback to defaults
   - Fail-fast approach ensures security

3. **Never commit .env files to production:**
   - Use hosted secret management (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Pass secrets via environment at runtime
   - Keep .env files local-only

## See Also

- [Backend Configuration](../apps/cosmic-horizons-api/src/config/)
- [Environment Variables Reference](./ENV-REFERENCE.md)
