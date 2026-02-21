import Redis from 'ioredis';

// ensure connect-redis is a callable factory during tests; jest.mock
// needs to be declared before the module that uses it is imported.
jest.mock('connect-redis', () => {
  // return a factory function that produces a minimal store with a
  // .client property and an .on method so express-session is happy.
  return jest.fn().mockImplementation(() => {
    return class RedisStore {
      client: any;
      constructor(opts: any) {
        this.client = opts.client;
      }
      on(_event: string, _listener: any) {
        // no-op for tests
      }
    };
  });
});

import { createSessionMiddleware } from './session.config';

describe('createSessionMiddleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['SESSION_SECRET'] =
      process.env['SESSION_SECRET'] ??
      'unit-test-session-secret-min-32-characters';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns express middleware with no store in dev by default', () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['SESSION_REDIS_ENABLED'];
    const mw = createSessionMiddleware();
    // express-session middlewares are functions with length 3
    expect(typeof mw).toBe('function');
    // session middleware exposes store on itself in some versions
    expect((mw as any).store).toBeUndefined();
  });

  it('uses Redis store when SESSION_REDIS_ENABLED=true', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['SESSION_REDIS_ENABLED'] = 'true';
    process.env['REDIS_HOST'] = 'localhost';
    process.env['REDIS_PORT'] = '6379';
    // spy on ioredis constructor
    const spy = jest.spyOn(Redis.prototype, 'on');
    const mw = createSessionMiddleware();
    expect(typeof mw).toBe('function');
    const store = (mw as any).store;
    expect(store).toBeDefined();
    // store should have client property with redis instance
    expect(store.client).toBeInstanceOf(Redis);
    spy.mockRestore();
  });

  it('throws if production and redis config missing', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['REDIS_HOST'];
    delete process.env['REDIS_PORT'];
    expect(() => createSessionMiddleware()).toThrow(
      /Redis session store requested but REDIS_HOST and REDIS_PORT are not both set/,
    );
  });

  it('defaults to redis when NODE_ENV=production even without flag', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['REDIS_HOST'] = '127.0.0.1';
    process.env['REDIS_PORT'] = '6379';
    const mw = createSessionMiddleware();
    expect((mw as any).store).toBeDefined();
  });
});
