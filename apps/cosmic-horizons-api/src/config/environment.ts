/**
 * Environment Configuration (Development)
 * Non-sensitive configuration that can be shared across team
 * Use for default values; override with .env files for sensitive data
 */

export interface EnvironmentConfig {
  // Application
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
  };

  // Server Configuration
  server: {
    port: number;
    host: string;
  };

  // Database Configuration
  database: {
    type: 'postgres';
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
  };

  // Redis Configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };

  // Authentication & JWT
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    sessionSecret: string;
  };

  // GitHub OAuth (sensitive - use .env)
  github: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };

  // Frontend Configuration
  frontend: {
    url: string;
  };

  // Feature Flags
  features: {
    ephemeris: {
      enabled: boolean;
      cacheEnabled: boolean;
      cacheTtlHours: number;
    };
    comments: {
      enabled: boolean;
    };
    jobs: {
      enabled: boolean;
    };
  };

  // Logging Configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    prettyPrint: boolean;
    redisEnabled: boolean;
    auditRetentionDays: number;
  };
}

/**
 * Development Environment Configuration
 * Shared defaults for team development
 */
export const environment: EnvironmentConfig = {
  app: {
    name: 'Cosmic Horizons API',
    version: '1.1.1',
    environment: 'development',
  },

  server: {
    port: parseInt(process.env['PORT'] || '3000', 10),
    host: process.env['SERVER_HOST'] || '0.0.0.0',
  },

  database: {
    type: 'postgres',
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    username: process.env['DB_USERNAME'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'postgres',
    database: process.env['DB_DATABASE'] || 'cosmic_horizons',
    synchronize: false, // Never use synchronize in production
    logging: process.env['NODE_ENV'] === 'development',
  },

  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: 0,
  },

  auth: {
    jwtSecret: process.env['JWT_SECRET'] || 'dev-secret-min-32-chars-long-dev',
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
    sessionSecret: process.env['SESSION_SECRET'] || 'dev-session-secret',
  },

  github: {
    clientId: process.env['GITHUB_CLIENT_ID'] || 'dev_github_client_id',
    clientSecret: process.env['GITHUB_CLIENT_SECRET'] || 'dev_github_client_secret',
    callbackUrl: process.env['GITHUB_CALLBACK_URL'] || 'http://localhost:3000/api/auth/github/callback',
  },

  frontend: {
    url: process.env['FRONTEND_URL'] || 'http://localhost:4200',
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
    prettyPrint: process.env['NODE_ENV'] === 'development',
    redisEnabled: process.env['LOGS_REDIS_ENABLED'] === 'true',
    auditRetentionDays: parseInt(process.env['AUDIT_RETENTION_DAYS'] || '90', 10),
  },
};
