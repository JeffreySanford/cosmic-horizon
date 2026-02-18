import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHiddenToDiscoveriesTable20260218 implements MigrationInterface {
  name = 'AddHiddenToDiscoveriesTable20260218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "discoveries" ADD COLUMN "hidden" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE "discoveries" SET "hidden" = false WHERE "hidden" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "discoveries" DROP COLUMN "hidden"`);
  }
}
