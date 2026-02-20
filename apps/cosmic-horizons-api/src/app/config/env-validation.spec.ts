import { validateEnvironment } from './env-validation';

describe('env validation', () => {
  it('rejects legacy aliases and requires canonical keys', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        DB_USERNAME: 'postgres',
        DB_DATABASE: 'cosmic_horizons',
        PORT: '3000',
      }),
    ).toThrow(/Legacy env key/);
  });

  it('fails fast for missing production secrets', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASSWORD: 'postgres',
        DB_NAME: 'cosmic_horizons',
        API_PORT: '3000',
        FRONTEND_URL: 'http://localhost:4200',
        JWT_SECRET: 'too-short',
        SESSION_SECRET: 'also-too-short',
      }),
    ).toThrow(/at least 32 characters/);
  });

  it('requires redis session config in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASSWORD: 'postgres',
        DB_NAME: 'cosmic_horizons',
        API_PORT: '3000',
        FRONTEND_URL: 'http://localhost:4200',
        JWT_SECRET: 'a'.repeat(32),
        SESSION_SECRET: 'b'.repeat(32),
        SESSION_REDIS_ENABLED: 'false',
      }),
    ).toThrow(/SESSION_REDIS_ENABLED must be true in production/);

    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASSWORD: 'postgres',
        DB_NAME: 'cosmic_horizons',
        API_PORT: '3000',
        FRONTEND_URL: 'http://localhost:4200',
        JWT_SECRET: 'a'.repeat(32),
        SESSION_SECRET: 'b'.repeat(32),
        SESSION_REDIS_ENABLED: 'true',
      }),
    ).toThrow(/REDIS_HOST and REDIS_PORT are required/);
  });
});
