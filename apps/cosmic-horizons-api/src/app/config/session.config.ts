import session, { SessionOptions } from 'express-session';
import Redis from 'ioredis';
import * as connectRedis from 'connect-redis';
import { Logger } from '@nestjs/common';
import { getSessionSecret } from './security.config';

const logger = new Logger('SessionConfig');

export function createSessionMiddleware(): ReturnType<typeof session> {
  const sessionSecret = getSessionSecret();

  const nodeEnv = process.env['NODE_ENV'] || 'development';
  const redisEnabled =
    (process.env['SESSION_REDIS_ENABLED'] ?? 'false').toLowerCase() === 'true';

  const useRedis = redisEnabled || nodeEnv === 'production';

  let store: session.Store | undefined;

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

    // connect-redis exports a function (callable) that returns a store class.
    // the types are awkward so cast to unknown first.
    const RedisStore = (connectRedis as unknown)(session) as new (opts: unknown) => session.Store;
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
