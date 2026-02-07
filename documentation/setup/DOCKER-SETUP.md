# Docker Setup Guide

## Overview

This guide walks you through setting up the Docker environment for the VLASS Portal. The stack consists of PostgreSQL 16 and Redis 7, networked together via Docker Compose.

## Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose)
- Minimum 2GB RAM and 5GB disk space
- Port availability: 15432 (Postgres), 6379 (Redis)

## Quick Start

### 1. Navigate to the Project Root

```bash
cd /path/to/vlass-portal
```

### 2. Start the Docker Stack

```bash
docker-compose up -d
```

This command starts both PostgreSQL and Redis in the background (`-d` flag).

### 3. Verify Health Status

Check that both services are running and healthy:

```bash
docker-compose ps
```

Expected output:

```bash
NAME                 COMMAND                  SERVICE      STATUS
vlass-postgres       "docker-entrypoint..."   postgres     Running (healthy)
vlass-redis          "redis-server..."        redis        Running (healthy)
```

### 4. Run Database Initialization

Once PostgreSQL is healthy, initialize the schema:

```bash
pnpm install
pnpm nx run vlass-api:serve
```

The application will automatically run migrations on startup. Verify in the logs:

```bash
[Nest] <timestamp> - 01/15/2025, 10:15:33 AM   LOG [NestFactory] Starting Nest application...
[Nest] <timestamp> - 01/15/2025, 10:15:34 AM   LOG [TypeOrmModule] Database initialized successfully
```

## Service Configuration

### PostgreSQL 16

**Port:** 15432 (external) / 5432 (internal)
**Container:** `vlass-postgres`  
**Credentials:**

- User: `vlass_user`
- Password: `vlass_password`
- Database: `vlass_db`

**Volumes:**

- `vlass-postgres-data` — persists all data between restarts

**Network:** `vlass-network`

### Redis 7

**Port:** 6379 (external and internal)  
**Container:** `vlass-redis`  
**Configuration:** AOF persistence enabled

**Volumes:**

- `vlass-redis-data` — persists all data between restarts

**Network:** `vlass-network`

## Docker Compose File Reference

The `docker-compose.yml` file defines the complete stack with:

- Health checks for both services
- Volume management for persistence
- Network isolation via `vlass-network`
- Resource limits and logging configuration

### Accessing Services from the Host

- **PostgreSQL:** `localhost:15432` (e.g., `psql -h localhost -U vlass_user -d vlass_db -p 15432`)
- **Redis:** `localhost:6379` (e.g., `redis-cli -h localhost -p 6379`)

### Accessing Services from Container

Within the container network:

- **PostgreSQL:** `vlass-postgres:5432`
- **Redis:** `vlass-redis:6379`

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Stop Services

```bash
docker-compose down
```

### Full Cleanup (Remove Volumes)

```bash
docker-compose down -v
```

**Warning:** This will delete all database and cache data.

### Restart Services

```bash
docker-compose restart
```

### Connect to PostgreSQL Shell

```bash
docker-compose exec postgres psql -U vlass_user -d vlass_db
```

### Inspect Database

```sql
-- List all tables
\dt

-- List all indexes
\di

-- Describe a table
\d users
```

## Troubleshooting

### Port Already in Use

If port 15432 or 6379 is already in use:

1. Stop conflicting services: `docker-compose down`
2. Alternative: Change ports in `docker-compose.yml`

   ```yaml
   ports:
     - "15433:5432"  # Use 15433 instead
   ```

3. Update environment variables in `.env`

### Database Won't Initialize

If you see connection errors:

1. Verify PostgreSQL is healthy:

   ```bash
   docker-compose ps postgres
   ```

2. Check logs:

   ```bash
   docker-compose logs postgres
   ```

3. Wait 10-15 seconds (container health check may still be running)

4. Manually trigger initialization:

   ```bash
   pnpm nx run vlass-api:serve
   ```

### Redis Connection Issues

1. Verify Redis is running:

   ```bash
   docker-compose ps redis
   ```

2. Test connection:

   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

   Expected response: `PONG`

### Clean Rebuild

If you need to start fresh:

```bash
docker-compose down -v
docker volume prune
docker-compose up -d
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL=postgresql://vlass_user:vlass_password@localhost:15432/vlass_db
TYPEORM_HOST=localhost
TYPEORM_PORT=15432
TYPEORM_USERNAME=vlass_user
TYPEORM_PASSWORD=vlass_password
TYPEORM_DATABASE=vlass_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Node
NODE_ENV=development
```

## Development Workflow

1. **Start services on boot:**

   ```bash
   docker-compose up -d
   ```

2. **Run tests with live database:**

   ```bash
   pnpm nx test vlass-api
   ```

3. **Watch for changes:**

   ```bash
   pnpm nx run vlass-api:serve --watch
   ```

4. **Stop services when done:**

   ```bash
   docker-compose down
   ```

For detailed information on application setup after Docker is running, see [DOCKER-BOOTSTRAP.md](./DOCKER-BOOTSTRAP.md).
