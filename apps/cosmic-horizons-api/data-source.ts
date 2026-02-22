import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { databaseConfig } from './src/app/database.config';
import { InitialSchema2026022000000 } from './src/migrations/20260220InitialSchema';

// This file provides a DataSource instance for the TypeORM CLI tools.  It is
// intentionally simple and mirrors the runtime configuration used by the
// NestJS application.  Be sure to `pnpm nx run cosmic-horizons-api:build`
// or otherwise compile before running CLI commands against .ts migrations.

const config = databaseConfig() as DataSourceOptions;

export default new DataSource({
  ...config,
  migrations: [InitialSchema2026022000000],
});
