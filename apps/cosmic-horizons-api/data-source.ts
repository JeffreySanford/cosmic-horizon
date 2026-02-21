import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseConfig } from './src/app/database.config';

// This file provides a DataSource instance for the TypeORM CLI tools.  It is
// intentionally simple and mirrors the runtime configuration used by the
// NestJS application.  Be sure to `pnpm nx run cosmic-horizons-api:build`
// or otherwise compile before running CLI commands against .ts migrations.

const config = databaseConfig();

export default new DataSource({
  ...config,
  migrations: ['apps/cosmic-horizons-api/src/migrations/*.ts'],
});
