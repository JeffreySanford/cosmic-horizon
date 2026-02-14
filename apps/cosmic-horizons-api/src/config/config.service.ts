/**
 * Configuration Service
 * Loads environment configuration from:
 * 1. environment.ts or environment.prod.ts (non-sensitive, shared defaults)
 * 2. .env.local (local overrides, git-ignored)
 * 3. .env.example (fallback for missing values, git-tracked)
 * 4. Environment variables
 */

import { Injectable } from '@nestjs/common';
import { EnvironmentConfig, environment as devEnvironment } from './environment';
import { environment as prodEnvironment } from './environment.prod';

@Injectable()
export class ConfigService {
  private config: EnvironmentConfig;

  constructor() {
    // Load appropriate environment config based on NODE_ENV
    const nodeEnv = process.env['NODE_ENV'] || 'development';

    if (nodeEnv === 'production') {
      try {
        this.config = prodEnvironment;
      } catch (error) {
        console.error('Failed to load production configuration:', error);
        throw error;
      }
    } else {
      this.config = devEnvironment;
    }

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Basic validation of critical config values
   */
  private validateConfig(): void {
    if (!this.config.app.name) {
      throw new Error('Configuration error: app.name is required');
    }

    if (!this.config.database.host) {
      throw new Error('Configuration error: database.host is required');
    }

    if (!this.config.redis.host) {
      throw new Error('Configuration error: redis.host is required');
    }
  }

  /**
   * Get full configuration object
   */
  getConfig(): EnvironmentConfig {
    return this.config;
  }

  /**
   * Get app configuration
   */
  getAppConfig() {
    return this.config.app;
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    return this.config.server;
  }

  /**
   * Get database configuration (TypeORM compatible)
   */
  getDatabaseConfig() {
    return {
      type: this.config.database.type,
      host: this.config.database.host,
      port: this.config.database.port,
      username: this.config.database.username,
      password: this.config.database.password,
      database: this.config.database.database,
      synchronize: this.config.database.synchronize,
      logging: this.config.database.logging,
      entities: ['dist/**/*.entity.{ts,js}'],
      migrations: ['dist/migrations/**/*.{ts,js}'],
      migrationsRun: false,
      subscribers: ['dist/**/*.subscriber.{ts,js}'],
      cli: {
        migrationsDir: 'src/migrations',
      },
    };
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig() {
    return this.config.redis;
  }

  /**
   * Get authentication configuration
   */
  getAuthConfig() {
    return this.config.auth;
  }

  /**
   * Get GitHub OAuth configuration
   */
  getGitHubConfig() {
    return this.config.github;
  }

  /**
   * Get frontend URL
   */
  getFrontendUrl(): string {
    return this.config.frontend.url;
  }

  /**
   * Get feature flags
   */
  getFeatures() {
    return this.config.features;
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature: keyof typeof this.config.features): boolean {
    const featureConfig = this.config.features[feature];
    return featureConfig?.enabled ?? false;
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig() {
    return this.config.logging;
  }

  /**
   * Check if we're in development
   */
  isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }

  /**
   * Check if we're in production
   */
  isProduction(): boolean {
    return this.config.app.environment === 'production';
  }
}
