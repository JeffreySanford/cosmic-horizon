import { MigrationInterface, QueryRunner } from 'typeorm';

// Baseline migration: mirrors the current entity set as of 2026-02-20.
// Future schema changes should be driven by generated migrations using the
// TypeORM CLI (`pnpm db:migrate:generate <Name>` or equivalent Nx target).
// The SQL below is deliberately a minimal representation; developers are
// encouraged to regenerate this file with the CLI when the real schema drifts.

export class InitialSchema2026022000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

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

    // dataset table for Phase 4 dataset catalog
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "datasets" (
        "id" varchar(255) PRIMARY KEY,
        "label" varchar(255),
        "last_updated" timestamptz
      );
    `);

    // jobs table used by job orchestration APIs.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "agent" varchar NOT NULL,
        "dataset_id" varchar NOT NULL,
        "tacc_job_id" varchar,
        "status" varchar NOT NULL,
        "progress" double precision NOT NULL DEFAULT 0,
        "params" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result" jsonb,
        "notes" text,
        "estimated_runtime_minutes" integer,
        "gpu_count" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "completed_at" timestamp
      );
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_jobs_user_created" ON "jobs" ("user_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_jobs_status_created" ON "jobs" ("status", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_jobs_tacc_job_id" ON "jobs" ("tacc_job_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_jobs_tacc_job_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_jobs_status_created"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_jobs_user_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "jobs"');
    await queryRunner.query('DROP TABLE IF EXISTS "datasets"');
    await queryRunner.query('DROP TABLE IF EXISTS "audit_logs"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}
