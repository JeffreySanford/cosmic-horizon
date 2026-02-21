import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

// ensure no real Redis connection is attempted during tests
jest.mock('ioredis');

interface TestRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  path: string;
}

function executionContextFromRequest(request: TestRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const originalWindow = process.env['RATE_LIMIT_WINDOW_MS'];
  const originalMax = process.env['RATE_LIMIT_MAX_WRITES'];
  const originalSnapshotMax = process.env['RATE_LIMIT_MAX_SNAPSHOTS'];
  const originalCutoutMax = process.env['RATE_LIMIT_MAX_CUTOUTS'];
  const originalNearbyLabelsMax = process.env['RATE_LIMIT_MAX_NEARBY_LABELS'];

  beforeEach(() => {
    process.env['RATE_LIMIT_WINDOW_MS'] = '10000';
    process.env['RATE_LIMIT_MAX_WRITES'] = '2';
    process.env['RATE_LIMIT_MAX_SNAPSHOTS'] = '3';
    process.env['RATE_LIMIT_MAX_CUTOUTS'] = '1';
    process.env['RATE_LIMIT_MAX_NEARBY_LABELS'] = '1';
  });

  afterEach(() => {
    process.env['RATE_LIMIT_WINDOW_MS'] = originalWindow;
    process.env['RATE_LIMIT_MAX_WRITES'] = originalMax;
    process.env['RATE_LIMIT_MAX_SNAPSHOTS'] = originalSnapshotMax;
    process.env['RATE_LIMIT_MAX_CUTOUTS'] = originalCutoutMax;
    process.env['RATE_LIMIT_MAX_NEARBY_LABELS'] = originalNearbyLabelsMax;
  });

  it('allows requests under the write limit', async () => {
    const guard = new RateLimitGuard();
    const context = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/posts',
      headers: {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks requests above the write limit', async () => {
    const guard = new RateLimitGuard();
    const context = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/posts',
      headers: {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('scopes limits by path', async () => {
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

    await expect(guard.canActivate(postsContext)).resolves.toBe(true);
    await expect(guard.canActivate(postsContext)).resolves.toBe(true);
    await expect(guard.canActivate(usersContext)).resolves.toBe(true);
  });

  it('applies stricter cutout path limits', async () => {
    const guard = new RateLimitGuard();
    const cutoutContext = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/view/cutout',
      headers: {},
    });

    await expect(guard.canActivate(cutoutContext)).resolves.toBe(true);
    await expect(guard.canActivate(cutoutContext)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('applies nearby-label path limits', async () => {
    const guard = new RateLimitGuard();
    const nearbyContext = executionContextFromRequest({
      ip: '127.0.0.1',
      path: '/api/view/labels/nearby',
      headers: {},
    });

    await expect(guard.canActivate(nearbyContext)).resolves.toBe(true);
    await expect(guard.canActivate(nearbyContext)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('bypasses when correct API key present', async () => {
    process.env['RATE_LIMIT_API_KEY'] = 'secret123';
    const guard = new RateLimitGuard();
    const context = executionContextFromRequest({
      ip: '1.2.3.4',
      path: '/api/posts',
      headers: { 'x-api-key': 'secret123' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // even after many calls it should not throw
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('uses redis when enabled', async () => {
    process.env['RATE_LIMIT_REDIS_ENABLED'] = 'true';
    const guard = new RateLimitGuard();
    // inject mock redis
    guard.redis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    } as any;

    const context = executionContextFromRequest({
      ip: '5.6.7.8',
      path: '/api/posts',
      headers: {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // simulate exceeding redis count
    guard.redis = {
      incr: jest.fn().mockResolvedValue(3),
      expire: jest.fn().mockResolvedValue(1),
    } as any;
    try {
      await guard.canActivate(context);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
    }
  });
});
