# Environment Variables Reference

Complete reference of all environment variables used by Cosmic Horizons.

## Database

| Variable      | Type   | Default                        | Required | Usage                                       |
| ------------- | ------ | ------------------------------ | -------- | ------------------------------------------- |
| `DB_TYPE`     | string | `postgres`                     | No       | Database system (always postgres)           |
| `DB_HOST`     | string | `localhost`                    | Yes      | PostgreSQL hostname                         |
| `DB_PORT`     | number | `15432`                        | No       | PostgreSQL host port (local Docker mapping) |
| `DB_USER`     | string | `cosmic_horizons_user`         | Yes      | Database user                               |
| `DB_PASSWORD` | string | `cosmic_horizons_password_dev` | Yes      | Database password (SENSITIVE)               |
| `DB_NAME`     | string | `cosmic_horizons`              | No       | Database name                               |

## Redis

| Variable             | Type    | Default     | Required | Usage                                              |
| -------------------- | ------- | ----------- | -------- | -------------------------------------------------- |
| `REDIS_HOST`         | string  | `localhost` | Yes      | Redis hostname                                     |
| `REDIS_PORT`         | number  | `6379`      | No       | Redis port                                         |
| `REDIS_PASSWORD`     | string  | (empty)     | No       | Redis password (SENSITIVE)                         |
| `REDIS_AUTH_ENABLED` | boolean | `false`     | No       | Enable Redis password auth in local/prod-like runs |
| `REDIS_DB`           | number  | `0`         | No       | Redis database number                              |
| `REDIS_CACHE_TTL`    | number  | `86400`     | No       | Default time‑to‑live (seconds) for cache entries   |

## Server

| Variable        | Type   | Default                 | Required | Usage                                                             |
| --------------- | ------ | ----------------------- | -------- | ----------------------------------------------------------------- |
| `NODE_ENV`      | string | `development`           | No       | Application environment                                           |
| `API_PORT`      | number | `3000`                  | No       | API server port                                                   |
| `API_PREFIX`    | string | `api`                   | No       | Path prefix for API routes (used by frontend proxy configuration) |
| `SERVER_HOST`   | string | `0.0.0.0`               | No       | API server bind address                                           |
| `FRONTEND_PORT` | number | `4200`                  | No       | Frontend dev server port                                          |
| `FRONTEND_URL`  | string | `http://localhost:4200` | Yes      | Frontend public URL                                               |

## Authentication

| Variable                | Type    | Default       | Required              | Usage                                                                              |
| ----------------------- | ------- | ------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `JWT_SECRET`            | string  | (dev-default) | Yes                   | JWT signing key (min 32 chars, SENSITIVE)                                          |
| `JWT_EXPIRES_IN`        | string  | `7d`          | No                    | JWT token expiration                                                               |
| `SESSION_SECRET`        | string  | (dev-default) | Yes                   | Express session secret (SENSITIVE)                                                 |
| `SESSION_REDIS_ENABLED` | boolean | false         | No (required in prod) | Enable Redis-backed session store (production). Implies `REDIS_HOST`/`REDIS_PORT`. |

## GitHub OAuth

| Variable               | Type   | Default                                          | Required | Usage                               |
| ---------------------- | ------ | ------------------------------------------------ | -------- | ----------------------------------- |
| `GITHUB_CLIENT_ID`     | string | (none)                                           | No       | OAuth app client ID                 |
| `GITHUB_CLIENT_SECRET` | string | (none)                                           | No       | OAuth app client secret (SENSITIVE) |
| `GITHUB_CALLBACK_URL`  | string | `http://localhost:3000/api/auth/github/callback` | No       | OAuth callback endpoint             |

## Logging

| Variable               | Type    | Default | Required | Usage                                 |
| ---------------------- | ------- | ------- | -------- | ------------------------------------- |
| `LOG_LEVEL`            | string  | `info`  | No       | Logging level (debug/info/warn/error) |
| `LOGS_REDIS_ENABLED`   | boolean | `false` | No       | Enable Redis-based audit logging      |
| `AUDIT_RETENTION_DAYS` | number  | `90`    | No       | Retention period for audit logs       |

## Features

## Event Streaming / Messaging

### RabbitMQ

| Variable             | Type   | Default     | Required | Usage                                   |
| -------------------- | ------ | ----------- | -------- | --------------------------------------- |
| `RABBITMQ_HOST`      | string | `localhost` | No       | RabbitMQ hostname for the event broker  |
| `RABBITMQ_PORT`      | number | `5672`      | No       | AMQP port                               |
| `RABBITMQ_MGMT_PORT` | number | `15672`     | No       | Management UI port                      |
| `RABBITMQ_USER`      | string | (none)      | No       | RabbitMQ username for local development |
| `RABBITMQ_PASS`      | string | (none)      | No       | RabbitMQ password for local development |

### Kafka

| Variable                         | Type   | Default          | Required | Usage                                          |
| -------------------------------- | ------ | ---------------- | -------- | ---------------------------------------------- |
| `KAFKA_BROKERS`                  | string | `localhost:9092` | No       | Comma-separated list of Kafka broker addresses |
| `KAFKA_HOST`                     | string | `localhost`      | No       | Host used by local Docker compose              |
| `KAFKA_PORT`                     | number | `9092`           | No       | Kafka listener port                            |
| `KAFKAJS_NO_PARTITIONER_WARNING` | number | `1`              | No       | Suppress KafkaJS partitioner warnings          |
| `KAFKA_METRICS_URL`              | string | (none)           | No       | Prometheus endpoint for Kafka metrics          |
| `KAFKA_JMX_PORT`                 | number | `9999`           | No       | JMX port for Kafka in Docker                   |

### Pulsar

| Variable             | Type    | Default                 | Required | Usage                                                |
| -------------------- | ------- | ----------------------- | -------- | ---------------------------------------------------- |
| `PULSAR_ENABLED`     | boolean | `false`                 | No       | Enable Pulsar broker in local demos/benchmarks       |
| `PULSAR_BROKERS`     | string  | `localhost:6650`        | No       | Pulsar broker connection string                      |
| `PULSAR_ADMIN_URL`   | string  | `http://localhost:8080` | No       | Pulsar admin REST API URL                            |
| `PULSAR_MANAGER_URL` | string  | `http://localhost:9527` | No       | Pulsar manager UI URL                                |
| `PULSAR_NAMESPACES`  | string  | (none)                  | No       | Comma-separated list of Pulsar namespaces used       |
| `PULSAR_TOPICS`      | string  | (none)                  | No       | Comma-separated list of Pulsar topics for evaluation |

## Features

| Variable                    | Type    | Default | Required | Usage                             |
| --------------------------- | ------- | ------- | -------- | --------------------------------- |
| `EPHEMERIS_ENABLED`         | boolean | `true`  | No       | Enable ephemeris search feature   |
| `EPHEMERIS_CACHE_ENABLED`   | boolean | `true`  | No       | Enable ephemeris result caching   |
| `EPHEMERIS_CACHE_TTL_HOURS` | number  | `24`    | No       | Ephemeris cache time-to-live      |
| `COMMENTS_ENABLED`          | boolean | `true`  | No       | Enable comments/threading feature |
| `JOBS_ENABLED`              | boolean | `true`  | No       | Enable remote jobs/TACC feature   |

## Application Info

| Variable      | Type   | Default               | Required | Usage                    |
| ------------- | ------ | --------------------- | -------- | ------------------------ |
| `APP_VERSION` | string | `1.1.1`               | No       | Application version      |
| `APP_NAME`    | string | `Cosmic Horizons API` | No       | Application display name |

## Development-Only

| Variable                       | Type   | Default                           | Required | Usage                         |
| ------------------------------ | ------ | --------------------------------- | -------- | ----------------------------- |
| `COSMIC_HORIZONS_API_BASE_URL` | string | `https://api.cosmic-horizons.org` | No       | Cosmic Horizons data API base |
| `COSMIC_HORIZONS_API_TIMEOUT`  | number | `30000`                           | No       | API timeout in milliseconds   |

## Examples

### Local Development (.env.local)

```dotenv
NODE_ENV=development
DB_HOST=localhost
DB_PORT=15432
DB_USER=cosmic_horizons_user
DB_PASSWORD=cosmic_horizons_password_dev
DB_NAME=cosmic_horizons
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:4200
JWT_SECRET=dev-secret-min-32-chars-long-change-this
SESSION_SECRET=dev-session-secret
LOG_LEVEL=info
```

### GitHub Actions (.secrets.env via CI)

```text
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
export REDIS_PASSWORD=<from-vault>
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

3. Session storage
   - `SESSION_REDIS_ENABLED` = `true` forces use of Redis for sessions; in production it is required.
   - `REDIS_HOST`/`REDIS_PORT` must be defined when using Redis for cache or sessions.
4. **Always** use min 32-character secrets in production
5. **Always** rotate secrets regularly
6. **Always** use HTTPS in production
7. **Always** validate secret values on startup (production)
8. **Always** use a secrets manager in production (AWS Secrets Manager, Vault, etc.)

## Troubleshooting

### "Configuration error: app.name is required"

- Check environment config is loading correctly
- Verify environment.ts file exists

### "Missing required environment variable: JWT_SECRET"

- In development: copy `apps/cosmic-horizons-api/.env.example` to `apps/cosmic-horizons-api/.env.local`
- In production: set JWT_SECRET environment variable with min 32 chars

### "Configuration validation failed"

- Check all required environment variables are set
- See `Required` column in tables above
- Verify NODE_ENV setting (different rules for dev vs prod)
