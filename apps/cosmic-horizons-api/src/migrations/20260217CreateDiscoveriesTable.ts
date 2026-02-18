import { MigrationInterface, QueryRunner } from 'typeorm';

export class 20260217CreateDiscoveriesTable implements MigrationInterface {
  name = '20260217CreateDiscoveriesTable';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "discoveries" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" character varying(512) NOT NULL,
        "body" text,
        "author" character varying(128) DEFAULT 'anonymous',
        "tags" jsonb,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await queryRunner.query(
      `INSERT INTO "discoveries" (id, title, body, author, tags, created_at) VALUES
        (uuid_generate_v4(), 'Welcome to Community Discoveries', 'This is a seeded announcement for the Community Discoveries prototype.', 'system', '["prototype","welcome"]', NOW() - INTERVAL '2 days'),
        (uuid_generate_v4(), 'Symposium 2026 — abstract deadline', 'Reminder: Symposium 2026 abstract deadline is April 1, 2026. Submit your abstracts to the planning committee.', 'announcements', '["symposium","deadline"]', NOW() - INTERVAL '1 day'),
        (uuid_generate_v4(), 'New: Community Feed is live (prototype)', 'Try posting short discoveries from the Community page. Entries are persisted in the DB and emit notification events for UI toasts.', 'system', '["feature","prototype"]', NOW())
      ON CONFLICT (id) DO NOTHING;`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "discoveries"`);
  }
}
