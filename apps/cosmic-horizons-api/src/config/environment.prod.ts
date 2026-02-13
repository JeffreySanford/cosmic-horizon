/**
 * Environment Configuration (Production)
 * Stricter validation and security for production deployments
 */

import { EnvironmentConfig } from './environment';

/**
 * Production Environment Configuration
 * Requires all sensitive values via .env or environment variables
 * Fails fast if critical values are missing
 */
export const environment: EnvironmentConfig = {
  app: {
    name: 'Cosmic Horizons API',
    version: process.env['APP_VERSION'] || '1.1.1',
    environment: 'production',
  },

  server: {
    port: parseInt(process.env['PORT'] || '3000', 10),
    host: process.env['SERVER_HOST'] || '0.0.0.0',
  },

  database: {
    type: 'postgres',
    host: validateRequired('DB_HOST', process.env['DB_HOST']),
    port: parseInt(validateRequired('DB_PORT', process.env['DB_PORT']), 10),
    username: validateRequired('DB_USERNAME', process.env['DB_USERNAME']),
    password: validateRequired('DB_PASSWORD', process.env['DB_PASSWORD']),
    database: validateRequired('DB_DATABASE', process.env['DB_DATABASE']),
    synchronize: false,
    logging: false,
  },

  redis: {
    host: validateRequired('REDIS_HOST', process.env['REDIS_HOST']),
    port: parseInt(validateRequired('REDIS_PORT', process.env['REDIS_PORT']), 10),
    password: process.env['REDIS_PASSWORD'],
    db: 0,
  },

  auth: {
    jwtSecret: validateRequired('JWT_SECRET', process.env['JWT_SECRET'], 32),
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
    sessionSecret: validateRequired('SESSION_SECRET', process.env['SESSION_SECRET']),
  },

  github: {
    clientId: validateRequired('GITHUB_CLIENT_ID', process.env['GITHUB_CLIENT_ID']),
    clientSecret: validateRequired('GITHUB_CLIENT_SECRET', process.env['GITHUB_CLIENT_SECRET']),
    callbackUrl: validateRequired('GITHUB_CALLBACK_URL', process.env['GITHUB_CALLBACK_URL']),
  },

  frontend: {
    url: validateRequired('FRONTEND_URL', process.env['FRONTEND_URL']),
  },

  features: {
    ephemeris: {
      enabled: true,
      cacheEnabled: true,
      cacheTtlHours: 24,
    },
    comments: {
      enabled: true,
    },
    jobs: {
      enabled: true,
    },
  },

  logging: {
    level: (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') || 'info',
    prettyPrint: false, // No pretty printing in production
    redisEnabled: process.env['LOGS_REDIS_ENABLED'] === 'true',
    auditRetentionDays: parseInt(process.env['AUDIT_RETENTION_DAYS'] || '90', 10),
  },
};

/**
 * Validate that a required environment variable is set
 * @param name - Variable name for error message
 * @param value - The value to validate
 * @param minLength - Optional minimum length for the value
 * @throws If value is not set or too short
 */
function validateRequired(name: string, value: string | undefined, minLength?: number): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Production deployments require all critical environment variables to be set.`
    );
  }

  if (minLength && value.length < minLength) {
    throw new Error(
      `Environment variable ${name} is too short. ` +
        `Minimum length required: ${minLength} characters.`
    );
  }

  return value;
}
