# Database Migrations

Cosmic Horizons uses TypeORM for database access and to manage schema evolution.
Migrations are stored in `apps/cosmic-horizons-api/src/migrations` and are
executed via the monorepo root scripts or Nx targets.

## Common Commands

```bash
# run pending migrations against the configured database
pnpm run db:migrate          # or `pnpm nx run cosmic-horizons-api:add-db-migrations`

# revert last migration
pnpm run db:migrate:revert

# create a new blank migration file with timestamp prefix
pnpm run db:migrate:create   "AddNewColumnToUsers"

# auto-generate a migration from changes in entities
pnpm run db:migrate:generate "DescribeChange"
```

The commands rely on `apps/cosmic-horizons-api/data-source.ts` which loads the
same configuration used by the running application, ensuring parity between
runtime and CLI environments.

### Baseline

An initial baseline migration (`20260220InitialSchema`) captures the schema
as of the Phase 5 hardening work. All future changes must be applied through
migrations rather than relying on `synchronize: true`.
