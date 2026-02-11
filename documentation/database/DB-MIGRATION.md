# Database Migration Strategy (SQLite ↔ PostgreSQL)

## Goal

Single migration system works for both SQLite (dev) and PostgreSQL (prod) without silent divergence.

---

## Tool Choice: TypeORM

TypeORM migrations work consistently across SQLite + Postgres with careful schema design.

```bash

# Initialize

npm install @nestjs/typeorm typeorm

# Create migration

pnpm nx exec -- typeorm migration:create \

  apps/vlass-api/src/migrations/InitialSchema

```

---

## Migration Template

```typescript
// apps/vlass-api/src/migrations/1700000000000-InitialSchema.ts

import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // users table
    // ============================================================
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          new TableColumn({
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()', // Works in Postgres; SQLite uses random()
          }),
          new TableColumn({
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
          }),
          new TableColumn({
            name: 'password_hash',
            type: 'varchar',
            length: '255',
          }),
          new TableColumn({
            name: 'display_name',
            type: 'varchar',
            length: '100',
          }),
          new TableColumn({
            name: 'roles',
            type: 'jsonb', // Postgres; SQLite will use TEXT
          }),
          new TableColumn({
            name: 'email_verified_at',
            type: 'timestamp',
            isNullable: true,
          }),
          new TableColumn({
            name: 'is_banned',
            type: 'boolean',
            default: false,
          }),
          new TableColumn({
            name: 'ban_reason',
            type: 'varchar',
            isNullable: true,
          }),
          new TableColumn({
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          }),
          new TableColumn({
            name: 'updated_at',
            type: 'timestamp',
            default: 'NOW()',
          }),
          new TableColumn({
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          }),
        ],
      }),
      true,
    );

    // Indexes
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_users_email',
        columnNames: ['email'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}

```

---

## ormconfig.ts (Both Databases)

```typescript
// apps/vlass-api/ormconfig.ts

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from './src/app/auth/user.entity';
import { Post } from './src/app/community/post.entity';
import { AuditEvent } from './src/app/audit/audit-event.entity';

const isSqlite = process.env.DB_URL?.startsWith('sqlite');
const isPostgres = process.env.DB_URL?.startsWith('postgresql');

const config: TypeOrmModuleOptions = {
  type: isSqlite ? 'sqlite' : 'postgres',
  url: process.env.DB_URL,

  // Entities (auto-discovery)
  entities: [User, Post, AuditEvent],
  synchronize: false, // Always use migrations, never auto-sync

  // Migrations
  migrations: ['src/migrations/*.ts'],
  migrationsRun: true, // Auto-run on startup

  // Database-specific options
  ...(isSqlite && {
    // SQLite
    database:
      process.env.DB_URL === 'sqlite:///:memory:' ? ':memory:' : './vlass.db',
    logging: process.env.NODE_ENV === 'development',
  }),

  ...(isPostgres && {
    // Postgres
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
    },
    ssl: process.env.NODE_ENV === 'production',
  }),
};

export default config;

```

---

## Schema Design Rules (Both DBs)

**Allowed:**

- `VARCHAR(n)` ✅

- `BOOLEAN` ✅

- `INTEGER`, `BIGINT` ✅

- `TIMESTAMP` ✅

- `JSONB` → TypeORM handles; SQLite uses `TEXT` + JSON1 extension

- `UUID` → TypeORM maps to `TEXT` in SQLite

**Forbidden (Postgres-only):**

- Array types: `INT[]` → Use JSONB instead

- Range types: `INT4RANGE` → Use two columns (min, max)

- Native UUID type in Postgres → Use `uuid` type in migration; TypeORM abstracts

**Forbidden (SQLite-only):**

- Foreign key constraint cascades (SQLite has limited CASCADE support)

  → Define in ORM, not DB-level

---

## Running Migrations

```bash

# Generate migration (interactive)

pnpm nx exec -- typeorm migration:create \

  apps/vlass-api/src/migrations/AddUserBanFields

# Run migrations (auto on app startup OR manual)

pnpm nx exec -- typeorm migration:run

# Revert last migration

pnpm nx exec -- typeorm migration:revert

# Show migration status

pnpm nx exec -- typeorm migration:show

```

---

## CI Testing (Both DBs)

```yaml

# .github/workflows/test.yml

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        db: [sqlite, postgres]
    steps:
      - uses: actions/checkout@v3

      - name: Setup SQLite

        if: matrix.db == 'sqlite'
        run: |
          echo "DB_URL=sqlite:///:memory:" >> $GITHUB_ENV

      - name: Setup Postgres

        if: matrix.db == 'postgres'
        run: |
          docker run -d -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:14
          sleep 10
          echo "DB_URL=postgresql://postgres:test@localhost:5432/vlass_test" >> $GITHUB_ENV

      - name: Run tests

        run: pnpm nx test --all

      - name: Run e2e

        run: pnpm nx e2e vlass-api-e2e

```

---

## Data Export (SQLite → Postgres Migration)

```bash
#!/bin/bash

# Migrate data from dev (SQLite) to prod (Postgres)

# 1. Dump SQLite

sqlite3 vlass.dev.db .dump > dump.sql

# 2. Transform SQL dialect (SQLite → Postgres)

# - Remove SQLite-specific pragmas

# - Convert AUTOINCREMENT → SERIAL

sed -i '/PRAGMA/d' dump.sql

# 3. Create Postgres schema from migrations

psql -h prod-db.example.com -U postgres -d vlass_prod \
  -c "GRANT CREATE ON DATABASE vlass_prod TO vlass_app;"

# 4. Run TypeORM migrations against Postgres

NODE_ENV=production DB_URL="postgresql://..." \
  pnpm nx exec -- typeorm migration:run

# 5. Import data (if needed)

# psql -h prod-db.example.com -U vlass_app -d vlass_prod < dump.sql

```

---

## Testing

```typescript
// libs/data-access/db/src/migrations/migrations.spec.ts

describe('Database Migrations', () => {
  describe('SQLite', () => {
    it('should create all tables for SQLite', async () => {
      const dataSource = new DataSource({
        type: 'sqlite',
        database: ':memory:',
        entities: [User, Post, AuditEvent],
        migrations: ['src/migrations/*.ts'],
        synchronize: false,
      });

      await dataSource.initialize();
      await dataSource.runMigrations();

      const tables = await dataSource.query(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );

      expect(tables.map((t) => t.name)).toContain('users');
      expect(tables.map((t) => t.name)).toContain('posts');
    });

    it('should support schema operations consistently', async () => {
      const dataSource = new DataSource({
        type: 'sqlite',
        database: ':memory:',
        entities: [User, Post],
        migrations: ['src/migrations/*.ts'],
      });

      await dataSource.initialize();
      await dataSource.runMigrations();

      // Insert + verify

      const user = dataSource.getRepository(User).create({
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
        roles: ['USER'],
      });

      const saved = await dataSource.getRepository(User).save(user);
      expect(saved.id).toBeDefined();
    });
  });

  describe('PostgreSQL', () => {
    it('should create all tables for Postgres', async () => {
      const dataSource = new DataSource({
        type: 'postgres',
        url:
          process.env.TEST_DB_URL ||
          'postgresql://postgres:test@localhost/vlass_test',
        entities: [User, Post, AuditEvent],
        migrations: ['src/migrations/*.ts'],
        synchronize: false,
      });

      await dataSource.initialize();
      await dataSource.runMigrations();

      const tables = await dataSource.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
      );

      expect(tables.map((t) => t.table_name)).toContain('users');
    });
  });
});

```

---

**Last Updated:** 2026-02-11

**Key Reminders:**

1. **Single migration system.**TypeORM handles both DB types.

2. **Never use auto-sync.** Always explicit migrations.

3. **Test against both SQLite + Postgres** in CI.

## 4. **Avoid DB-specific types.** Keep schema portable
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
