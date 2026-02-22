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
    await ensureRequiredRuntimeTables(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function ensureRequiredRuntimeTables(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "datasets" (
      "id" varchar(255) PRIMARY KEY,
      "label" varchar(255),
      "last_updated" timestamptz
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "jobs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "agent" varchar NOT NULL,
      "dataset_id" varchar NOT NULL,
      "tacc_job_id" varchar,
      "status" varchar NOT NULL,
      "progress" double precision NOT NULL DEFAULT 0,
      "params" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "result" jsonb,
      "notes" text,
      "estimated_runtime_minutes" integer,
      "gpu_count" integer,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "completed_at" timestamp
    )
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS "IDX_jobs_user_created" ON "jobs" ("user_id", "created_at")',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS "IDX_jobs_status_created" ON "jobs" ("status", "created_at")',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS "IDX_jobs_tacc_job_id" ON "jobs" ("tacc_job_id")',
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS "broker_metrics" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "brokerName" text NOT NULL,
      "messagesPerSecond" integer,
      "p50LatencyMs" numeric(8,2),
      "p95LatencyMs" numeric(8,2),
      "p99LatencyMs" numeric(8,2),
      "memoryUsageMb" numeric(10,2),
      "cpuPercentage" numeric(5,2),
      "connectionCount" integer,
      "isConnected" boolean NOT NULL DEFAULT false,
      "uptime" text,
      "partitionCount" integer,
      "brokerCount" integer,
      "topicStats" jsonb,
      "errorMessage" text,
      "capturedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS "IDX_broker_metrics_broker_captured" ON "broker_metrics" ("brokerName", "capturedAt")',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS "IDX_broker_metrics_captured" ON "broker_metrics" ("capturedAt")',
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadFirstEnvFile();

  const maxAttempts = 10;
  const retryDelayMs = 2000;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await checkDatabaseConnectivity();
      console.log('Preflight OK: API database credentials are valid.');
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  try {
    throw lastError ?? new Error('Unknown preflight failure');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dbUser = envValue('DB_USER', 'cosmic_horizons_user');
    const dbName = envValue('DB_NAME', 'cosmic_horizons');
    const dbPort = envValue('DB_PORT', '15432');
    const hints = [
      `Attempts=${maxAttempts}, retry_delay_ms=${retryDelayMs}`,
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
