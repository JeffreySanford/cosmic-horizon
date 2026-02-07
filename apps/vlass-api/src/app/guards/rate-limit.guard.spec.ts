import { ExecutionContext, TooManyRequestsException } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitGuard } from './rate-limit.guard';

function executionContextFromRequest(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const originalWindow = process.env['RATE_LIMIT_WINDOW_MS'];
  const originalMax = process.env['RATE_LIMIT_MAX_WRITES'];

  beforeEach(() => {
    process.env['RATE_LIMIT_WINDOW_MS'] = '10000';
    process.env['RATE_LIMIT_MAX_WRITES'] = '2';
  });

  afterEach(() => {
    process.env['RATE_LIMIT_WINDOW_MS'] = originalWindow;
    process.env['RATE_LIMIT_MAX_WRITES'] = originalMax;
  });

  it('allows requests under the write limit', () => {
    const guard = new RateLimitGuard();
    const context = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/posts',
      headers: {},
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks requests above the write limit', () => {
    const guard = new RateLimitGuard();
    const context = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/posts',
      headers: {},
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(TooManyRequestsException);
  });

  it('scopes limits by path', () => {
    const guard = new RateLimitGuard();
    const postsContext = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/posts',
      headers: {},
    });
    const usersContext = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/users',
      headers: {},
    });

    expect(guard.canActivate(postsContext)).toBe(true);
    expect(guard.canActivate(postsContext)).toBe(true);
    expect(guard.canActivate(usersContext)).toBe(true);
  });
});
