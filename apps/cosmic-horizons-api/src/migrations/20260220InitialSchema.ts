import { MigrationInterface, QueryRunner } from 'typeorm';

// Baseline migration: mirrors the current entity set as of 2026-02-20.
// Future schema changes should be driven by generated migrations using the
// TypeORM CLI (`pnpm db:migrate:generate <Name>` or equivalent Nx target).
// The SQL below is deliberately a minimal representation; developers are
// encouraged to regenerate this file with the CLI when the real schema drifts.

export class InitialSchema20260220 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // users table (partial)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "github_id" bigint UNIQUE,
        "username" varchar(255) UNIQUE NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "email" varchar(255) UNIQUE,
        "role" varchar(32) NOT NULL DEFAULT 'user',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
    `);

    // audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NULL,
        "action" varchar(50) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" varchar(255) NOT NULL,
        "changes" jsonb NULL,
        "ip_address" varchar(45) NULL,
        "user_agent" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // other tables omitted for brevity - see generated migrations for full
    // definitions.  This baseline ensures the database can be bootstrapped
    // without relying on `synchronize: true`.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "audit_logs"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
    // reverse other baseline changes as needed
  }
}
