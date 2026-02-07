# Docker Bootstrap & Application Startup

## Overview

This guide covers initializing the VLASS Portal application after Docker services are running. It includes database setup, environment configuration, dependency installation, and verification steps.

## Prerequisites

Ensure Docker services are running and healthy:

```bash
docker-compose ps
```

Both `vlass-postgres` and `vlass-redis` should show status `Running (healthy)`.

## Step 1: Install Dependencies

From the project root:

```bash
pnpm install
```

This installs all workspace dependencies including:

- NestJS runtime and build tools
- TypeORM and database drivers
- Angular and frontend dependencies
- Testing frameworks and utilities

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL="postgresql://vlass_user:vlass_password@localhost:15432/vlass_db"
TYPEORM_HOST="localhost"
TYPEORM_PORT="15432"
TYPEORM_USERNAME="vlass_user"
TYPEORM_PASSWORD="vlass_password"
TYPEORM_DATABASE="vlass_db"
TYPEORM_SYNCHRONIZE="false"
TYPEORM_LOGGING="true"
TYPEORM_MIGRATIONS_RUN="true"

# Redis Configuration
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Application
NODE_ENV="development"
PORT="3333"

# TypeORM Entities & Migrations
TYPEORM_ENTITIES="src/app/entities/**/*.entity.ts"
TYPEORM_MIGRATIONS="src/database/migrations/**/*.ts"
```

## Step 3: Start the Application

### Option A: Development Mode (with watch)

```bash
pnpm nx run vlass-api:serve
```

Expected output:

```bash
> nx run vlass-api:serve
[Nest] ... - 01/15/2025, 10:15:33 AM   LOG [NestFactory] Starting Nest application...
[Nest] ... - 01/15/2025, 10:15:34 AM   LOG [TypeOrmModule] Connecting to DB...
[Nest] ... - 01/15/2025, 10:15:35 AM   LOG [TypeOrmModule] Database connected successfully
[Nest] ... - 01/15/2025, 10:15:35 AM   LOG [NestApplication] Nest application successfully started
[Nest] ... - 01/15/2025, 10:15:35 AM   LOG Listening on port 3333
```

### Option B: Production Build

```bash
# Build the application
pnpm nx build vlass-api

# Start the compiled application
node dist/apps/vlass-api/main.js
```

## Step 4: Verify Application Health

### Health Check Endpoint

```bash
curl http://localhost:3333/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:15:35.000Z",
  "database": "connected",
  "environment": "development"
}
```

### Database Connection

The application automatically:

1. Connects to PostgreSQL
2. Initializes TypeORM data source
3. Creates/verifies all tables via entities

Verify tables exist:

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U vlass_user -d vlass_db

# List tables
\dt
```

Expected tables:

- `users`
- `posts`
- `revisions`
- `comments`
- `snapshots`
- `audit_logs`
- `vlass_tile_cache`

## Step 5: Run Tests

Verify the full application is working:

```bash
# Run all tests
pnpm nx test vlass-api

# Run specific test file
pnpm nx test vlass-api --testFile=app.service.spec.ts

# Run tests with coverage
pnpm nx test vlass-api --coverage
```

Expected output:

```bash
 PASS  src/app/app.service.spec.ts
 PASS  src/app/app.controller.spec.ts
 
 Test Suites: 2 passed, 2 total
 Tests:       39 passed, 39 total
 Snapshots:   0 total
 Time:        1.01s
```

## Step 6: Verify API Endpoints

The API provides CRUD endpoints for users and posts:

### User Endpoints

```bash
# Get all users
curl http://localhost:3333/api/users

# Create a user
curl -X POST http://localhost:3333/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "full_name": "Test User"
  }'

# Get a specific user
curl http://localhost:3333/api/users/{userId}

# Update a user
curl -X PUT http://localhost:3333/api/users/{userId} \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Updated Name"}'

# Delete a user
curl -X DELETE http://localhost:3333/api/users/{userId}
```

### Post Endpoints

```bash
# Get all posts
curl http://localhost:3333/api/posts

# Get published posts
curl http://localhost:3333/api/posts/published

# Create a post
curl -X POST http://localhost:3333/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Post",
    "content": "Post content here",
    "user_id": "{userId}"
  }'

# Get a specific post
curl http://localhost:3333/api/posts/{postId}

# Update a post
curl -X PUT http://localhost:3333/api/posts/{postId} \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'

# Publish a post
curl -X POST http://localhost:3333/api/posts/{postId}/publish

# Unpublish a post
curl -X POST http://localhost:3333/api/posts/{postId}/unpublish

# Delete a post
curl -X DELETE http://localhost:3333/api/posts/{postId}
```

## Step 7: Linting and Type Checking

Verify code quality:

```bash
# Run ESLint
pnpm nx lint vlass-api

# TypeScript type checking
pnpm nx typecheck vlass-api

# Comprehensive validation
pnpm nx run-many --target=test,lint,typecheck --projects=vlass-api
```

All gates should pass:

```bash
✓ Tests: 39/39 passing
✓ Linting: 0 errors, 0 warnings
✓ TypeScript: Successfully compiled
```

## Common Issues & Solutions

### Port 3333 Already in Use

If you get "EADDRINUSE":

```bash
# Option 1: Kill the process on port 3333
lsof -ti :3333 | xargs kill -9

# Option 2: Use a different port
PORT=3334 pnpm nx run vlass-api:serve
```

### Database Connection Timeout

If you see "Cannot connect to database":

1. Ensure PostgreSQL is healthy:

   ```bash
   docker-compose ps postgres
   ```

2. Wait 10 seconds and try again (container may still be initializing)

3. Check database credentials in `.env` match `docker-compose.yml`

4. Manually test connection:

   ```bash
   psql postgresql://vlass_user:vlass_password@localhost:15432/vlass_db
   ```

### Missing Tables

If entities don't create tables automatically:

1. Verify `.env` has `TYPEORM_SYNCHRONIZE=true` for development

2. Manually initialize schema:

   ```bash
   # Copy and run init.sql manually
   docker-compose exec postgres psql -U vlass_user -d vlass_db < docs/database/init.sql
   ```

### Tests Failing

If tests fail:

1. Ensure `.env` is present with valid credentials

2. Check database is clean (no conflicting test data):

   ```bash
   docker-compose down -v
   docker-compose up -d
   pnpm nx run vlass-api:serve
   ```

3. Review test output for specific error:

   ```bash
   pnpm nx test vlass-api --verbose
   ```

## Development Workflow

**Standard development flow:**

1. Start Docker services:

   ```bash
   docker-compose up -d
   ```

2. Install dependencies (first time only):

   ```bash
   pnpm install
   ```

3. Configure `.env`

4. Start application in watch mode:

   ```bash
   pnpm nx run vlass-api:serve
   ```

5. In another terminal, run tests in watch mode:

   ```bash
   pnpm nx test vlass-api --watch
   ```

6. Make code changes — tests and server will auto-reload

7. Stop when done:

   ```bash
   docker-compose down
   ```

## Database Schema Overview

The application uses TypeORM to manage 7 tables via entity classes:

| Table | Purpose | Relations |
| --- | --- | --- |
| `users` | User accounts and profiles | Posts, Revisions, Comments, AuditLogs |
| `posts` | Notebooks/articles (can be draft or published) | User, Revisions, Comments, Snapshots |
| `revisions` | Post edit history | Post, User |
| `comments` | Comments on posts | Post, User |
| `snapshots` | Viewer state snapshots attached to posts | Post |
| `audit_logs` | Action audit trail (90-day retention) | User |
| `vlass_tile_cache` | Cache for VLASS tiles | (standalone) |

See [TYPEORM-SETUP.md](../database/TYPEORM-SETUP.md) for entity details and relationship mapping.

## Next Steps

- **Development Guide:** [CODING-STANDARDS.md](../development/CODING-STANDARDS.md)
- **Project Overview:** [OVERVIEW.md](../guides/OVERVIEW.md)
- **Entity Details:** [TYPEORM-SETUP.md](../database/TYPEORM-SETUP.md)
