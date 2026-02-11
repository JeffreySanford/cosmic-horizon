# Database Seeding Operations

Status date: 2026-02-10

This document explains what `documentation/database/init.sql` does during local bootstrap and how to use it safely.

## Purpose

`init.sql` is executed by PostgreSQL container initialization to:

- Enable required extensions (`uuid-ossp`, `pgcrypto`)
- Create baseline tables and indexes for MVP entities
- Install `updated_at` trigger behavior
- Seed local development users for JWT/RBAC testing
- Grant table/sequence/schema privileges to `vlass_user`

The script is designed to be idempotent where practical (`IF NOT EXISTS`, `ON CONFLICT`).

## Seeded Accounts

`init.sql` seeds two local-only users:

- `test@vlass.local` / `Password123!` with role `user`
- `admin@vlass.local` / `AdminPassword123!` with role `admin`

Passwords are inserted as bcrypt hashes via PostgreSQL `crypt(..., gen_salt('bf'))`.

## Execution Model

- Runs automatically on first container init when mounted to `/docker-entrypoint-initdb.d/`
- On existing database volumes, it does not automatically re-run full initialization
- Upserts (`ON CONFLICT`) update seeded users if the script is executed again

## Safety Boundaries

- Seed credentials are for local development only
- Never deploy these credentials or this seeding behavior to production
- Production environments should use migrations plus environment-managed identity provisioning

## Related Docs

- `documentation/database/TYPEORM-SETUP.md`
- `documentation/database/DATABASE-SCHEMA.md`
- `documentation/backend/AUTH-VERIFICATION.md`
- `documentation/setup/DOCKER-BOOTSTRAP.md`
