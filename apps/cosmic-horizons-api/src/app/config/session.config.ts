// using require to obtain callable session factory without esModuleInterop
const session: typeof import('express-session') = require('express-session');
import { SessionOptions, Store as SessionStore } from 'express-session';
import Redis from 'ioredis';
// `connect-redis` exports a factory function; using require avoids
// incorrect TypeScript declaration which has no call signature.
const connectRedis = require('connect-redis');
import { Logger } from '@nestjs/common';
import { getSessionSecret } from './security.config';

const logger = new Logger('SessionConfig');

export function createSessionMiddleware(): ReturnType<typeof session> {
  const sessionSecret = getSessionSecret();

  const nodeEnv = process.env['NODE_ENV'] || 'development';
  const redisEnabled =
    (process.env['SESSION_REDIS_ENABLED'] ?? 'false').toLowerCase() === 'true';

  const useRedis = redisEnabled || nodeEnv === 'production';

  let store: SessionStore | undefined;

  if (useRedis) {
    const host = process.env['REDIS_HOST'];
    const portStr = process.env['REDIS_PORT'];
    if (!host || !portStr) {
      throw new Error(
        'Redis session store requested but REDIS_HOST and REDIS_PORT are not both set',
      );
    }
    const port = Number(portStr);
    const client = new Redis({
      host,
      port,
      password: process.env['REDIS_PASSWORD'] || undefined,
      tls:
        (process.env['REDIS_TLS_ENABLED'] ?? 'false').toLowerCase() === 'true'
          ? {}
          : undefined,
    });

    client.on('error', (err: unknown) => {
      logger.error('Redis session error', err as Error);
      if (nodeEnv === 'production') {
        // fail fast so app doesn't silently run with memory store
        process.exit(1);
      }
    });

    // `connectRedis` is `any` via require, so we can call it directly.
    const RedisStore = connectRedis(session) as new (opts: unknown) => SessionStore;
    store = new RedisStore({ client });
  }

  const options: SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: nodeEnv === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  };

  if (store) {
    options.store = store;
  }

  return session(options);
}
