const LEGACY_KEY_REPLACEMENTS: Record<string, string> = {
  DB_USERNAME: 'DB_USER',
  DB_DATABASE: 'DB_NAME',
  PORT: 'API_PORT',
};

const PRODUCTION_REQUIRED_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'API_PORT',
  'FRONTEND_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
] as const;

type ValidationResult = {
  env: Record<string, string>;
  errors: string[];
};

function normalizeRawEnv(
  rawEnv: Record<string, unknown>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    if (value === undefined || value === null) {
      continue;
    }
    const stringValue = String(value).trim();
    if (stringValue.length === 0) {
      continue;
    }
    normalized[key] = stringValue;
  }
  return normalized;
}

function isValidPort(port: string): boolean {
  const parsed = Number.parseInt(port, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;
}

function collectLegacyKeyViolations(
  env: Record<string, string>,
  errors: string[],
): void {
  for (const [legacyKey, canonicalKey] of Object.entries(
    LEGACY_KEY_REPLACEMENTS,
  )) {
    if (env[legacyKey]) {
      errors.push(
        `Legacy env key ${legacyKey} is not supported; use ${canonicalKey}.`,
      );
    }
  }
}

function collectValidationResult(
  rawEnv: Record<string, unknown>,
): ValidationResult {
  const errors: string[] = [];
  const env = normalizeRawEnv(rawEnv);

  collectLegacyKeyViolations(env, errors);

  const nodeEnv = env['NODE_ENV'] ?? 'development';
  env['NODE_ENV'] = nodeEnv;
  env['API_PORT'] = env['API_PORT'] ?? '3000';

  if (!isValidPort(env['API_PORT'])) {
    errors.push(
      `API_PORT must be an integer between 1 and 65535 (received: ${env['API_PORT']}).`,
    );
  }
  if (env['DB_PORT'] && !isValidPort(env['DB_PORT'])) {
    errors.push(
      `DB_PORT must be an integer between 1 and 65535 (received: ${env['DB_PORT']}).`,
    );
  }
  if (env['REDIS_PORT'] && !isValidPort(env['REDIS_PORT'])) {
    errors.push(
      `REDIS_PORT must be an integer between 1 and 65535 (received: ${env['REDIS_PORT']}).`,
    );
  }
  if (env['KAFKA_PORT'] && !isValidPort(env['KAFKA_PORT'])) {
    errors.push(
      `KAFKA_PORT must be an integer between 1 and 65535 (received: ${env['KAFKA_PORT']}).`,
    );
  }
  if (env['RABBITMQ_PORT'] && !isValidPort(env['RABBITMQ_PORT'])) {
    errors.push(
      `RABBITMQ_PORT must be an integer between 1 and 65535 (received: ${env['RABBITMQ_PORT']}).`,
    );
  }

  if (nodeEnv === 'production') {
    for (const key of PRODUCTION_REQUIRED_KEYS) {
      if (!env[key]) {
        errors.push(`${key} is required in production.`);
      }
    }

    // session store must use Redis in prod
    if ((env['SESSION_REDIS_ENABLED'] ?? 'false').toLowerCase() !== 'true') {
      errors.push('SESSION_REDIS_ENABLED must be true in production.');
    }
    if (!env['REDIS_HOST'] || !env['REDIS_PORT']) {
      errors.push(
        'REDIS_HOST and REDIS_PORT are required when using Redis in production.',
      );
    }

    const jwtSecret = env['JWT_SECRET'];
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production.');
    }

    const sessionSecret = env['SESSION_SECRET'];
    if (sessionSecret && sessionSecret.length < 32) {
      errors.push(
        'SESSION_SECRET must be at least 32 characters in production.',
      );
    }
  }

  return {
    env,
    errors,
  };
}

export function validateEnvironment(
  rawEnv: Record<string, unknown>,
): Record<string, string> {
  const result = collectValidationResult(rawEnv);

  if (result.errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n- ${result.errors.join('\n- ')}`,
    );
  }

  return result.env;
}

export function validateAndAssignEnvironment(
  rawEnv: Record<string, unknown> = process.env,
): void {
  const validated = validateEnvironment(rawEnv);
  for (const [key, value] of Object.entries(validated)) {
    process.env[key] = value;
  }
}
