import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

function loadFirstEnvFile() {
  const candidates = [
    resolve(process.cwd(), 'apps/cosmic-horizons-api/.env.local'),
    resolve(process.cwd(), 'apps/cosmic-horizons-api/.env'),
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env'),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }
    const content = readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      const separator = line.indexOf('=');
      if (separator <= 0) {
        continue;
      }
      const key = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    return filePath;
  }
  return null;
}

function envValue(key, fallback) {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function isAuthFailure(message) {
  return /password authentication failed/i.test(message);
}

function maybeHintForUser(user) {
  if (user.includes('-')) {
    return `DB_USER="${user}" contains "-". Your Docker defaults use underscores (for example: cosmic_horizons_user).`;
  }
  return null;
}

async function checkDatabaseConnectivity() {
  const config = {
    host: envValue('DB_HOST', 'localhost'),
    port: Number.parseInt(envValue('DB_PORT', '15432'), 10),
    user: envValue('DB_USER', 'cosmic_horizons_user'),
    password: envValue('DB_PASSWORD', 'cosmic_horizons_password_dev'),
    database: envValue('DB_NAME', 'cosmic_horizons'),
    connectionTimeoutMillis: 3000,
  };

  const client = new pg.Client(config);
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  loadFirstEnvFile();

  try {
    await checkDatabaseConnectivity();
    console.log('Preflight OK: API database credentials are valid.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dbUser = envValue('DB_USER', 'cosmic_horizons_user');
    const dbName = envValue('DB_NAME', 'cosmic_horizons');
    const dbPort = envValue('DB_PORT', '15432');
    const hints = [
      `Configured DB_USER=${dbUser}`,
      `Configured DB_NAME=${dbName}`,
      `Configured DB_PORT=${dbPort}`,
      maybeHintForUser(dbUser),
      isAuthFailure(message)
        ? 'Auth mismatch detected between API env and running Postgres volume credentials.'
        : null,
      'If you changed DB credentials recently, run: pnpm run start:infra:reset',
      'Or align apps/cosmic-horizons-api/.env.local with docker-compose DB_* values.',
    ].filter(Boolean);

    console.error(
      'Preflight failed: database connectivity check failed before starting API.',
    );
    console.error(`Reason: ${message}`);
    for (const hint of hints) {
      console.error(`- ${hint}`);
    }
    process.exit(1);
  }
}

void main();
