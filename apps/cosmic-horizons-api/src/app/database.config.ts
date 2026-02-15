import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  User,
  Post,
  Revision,
  Comment,
  CommentReport,
  Snapshot,
  ViewerState,
  ViewerSnapshot,
  AuditLog,
  CosmicTileCache,
} from './entities';
import { loadEnvFromFirstAvailable } from './config/env-loader';

loadEnvFromFirstAvailable();
const isProduction = process.env.NODE_ENV === 'production';

const envValue = (key: string, fallback: string): string => {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return fallback;
};
const envFlag = (key: string, fallback: boolean): boolean => {
  const raw = envValue(key, fallback ? 'true' : 'false')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};
const requiredEnvNoFallback = (key: string): string => {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  if (process.env.NODE_ENV === 'test') {
    throw new Error(`${key} is required for database configuration. Set it in .env.local or .env.example.`);
  }
  throw new Error(`${key} is required for database configuration. Set it in environment variables.`);
};
const loggingEnabled = envFlag('DB_LOGGING', false);
const allowSensitiveDbLogging = envFlag('DB_ALLOW_SENSITIVE_LOGGING', false);

if (isProduction && loggingEnabled && !allowSensitiveDbLogging) {
  throw new Error(
    'DB_LOGGING is disabled in production by default to prevent sensitive data exposure. Set DB_ALLOW_SENSITIVE_LOGGING=true to override intentionally.',
  );
}

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: envValue('DB_HOST', 'localhost'),
  port: parseInt(envValue('DB_PORT', '15432'), 10),
  username: requiredEnvNoFallback('DB_USER'),
  password: requiredEnvNoFallback('DB_PASSWORD'),
  database: envValue('DB_NAME', 'cosmic_horizons'),
  entities: [
    User,
    Post,
    Revision,
    Comment,
    CommentReport,
    Snapshot,
    ViewerState,
    ViewerSnapshot,
    AuditLog,
    CosmicTileCache,
  ],
  synchronize: false,
  logging: loggingEnabled,
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: envFlag('DB_SSL_REJECT_UNAUTHORIZED', true),
        }
      : false,
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
