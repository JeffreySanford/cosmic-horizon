# API Rate Limiting Strategy

## Overview

Three-tier rate limiting:

1. **IP-based** (global): 1000 req/min to prevent bot attacks

2. **User-based** (authenticated): 5000 req/min per user

3. **User + Endpoint** (per route): Variable per endpoint

---

## Implementation (NestJS + Redis)

### Guards

```typescript
// apps/vlass-api/src/app/guards/throttle.guard.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class IpThrottleGuard implements CanActivate {
  constructor(private redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || 'unknown';

    const key = `throttle:ip:${ip}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, 60); // 60-sec window
    }

    if (current > 1000) {
      throw new BadRequestException('Rate limit exceeded: 1000/min per IP');
    }

    return true;
  }
}

@Injectable()
export class UserThrottleGuard implements CanActivate {
  constructor(private redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) return true; // Skip for unauthenticated

    const key = `throttle:user:${userId}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, 60);
    }

    if (current > 5000) {
      throw new BadRequestException('Rate limit exceeded: 5000/min per user');
    }

    return true;
  }
}

@Injectable()
export class EndpointThrottleGuard implements CanActivate {
  // Per-endpoint limits (configured via decorator)
  private limits = {
    'POST:/community/posts': 100, // 100/min
    'GET:/tap-search': 500, // 500/min
    'POST:/community/mods/actions': 50, // 50/min (mod action)
  };

  constructor(private redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || 'anonymous';

    const method = request.method;
    const path = request.path;
    const route = `${method}:${path}`;

    const limit = this.limits[route];
    if (!limit) return true; // No limit configured

    const key = `throttle:endpoint:${userId}:${route}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, 60);
    }

    if (current > limit) {
      throw new BadRequestException(
        `Rate limit exceeded: ${limit}/min for ${route}`,
      );
    }

    return true;
  }
}

```

### Usage in Controller

```typescript
// apps/vlass-api/src/app/community/community.controller.ts

import { UseGuards } from '@nestjs/common';
import {
  IpThrottleGuard,
  EndpointThrottleGuard,
} from '../guards/throttle.guard';

@Controller('community')
export class CommunityController {
  @Post('posts')
  @UseGuards(IpThrottleGuard, EndpointThrottleGuard)
  async createPost(@Body() dto: CreatePostDto): Promise<PostDto> {
    // Limited to 100/min per user
    return this.posts.create(dto);
  }

  @Get('posts/:id')
  @UseGuards(IpThrottleGuard)
  async getPost(@Param('id') id: string): Promise<PostDto> {
    // Limited to 1000/min per IP (no user-level limit)
    return this.posts.findOne(id);
  }
}

```

---

## Response Headers

When rate limited or near limit:

```text
HTTP/1.1 200 OK

X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1739044260

// Or on failure:
HTTP/1.1 429 Too Many Requests

Retry-After: 30
Content-Type: application/json
{ "error": "Rate limit exceeded: 100/min" }

```

---

## Bypass Mechanism

Premium users or service accounts bypass rate limits:

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const user = request.user;

  // Skip for premium users
  if (user?.tier === "PREMIUM" || user?.isServiceAccount) {
    return true;
  }

  // ... apply normal limits
}

```

---

## Monitoring

Log rate limit events to track abuse:

```typescript
// Log when user approaches limit (80% of quota)
const threshold = limit * 0.8;

if (current > threshold) {
  this.logger.warn(`Rate limit approaching for ${userId}`, {
    route,
    current,
    limit,
  });
}

// Log when rate limit exceeded
if (current > limit) {
  this.audit.log({
    action: 'RATE_LIMIT_EXCEEDED',
    actor_id: userId,
    endpoint: route,
    count: current,
    limit,
    timestamp: new Date(),
  });
}

```

---

## Testing

```typescript
// apps/vlass-api-e2e/src/rate-limiting.spec.ts

describe('Rate Limiting', () => {
  it('should reject after 100 posts/min', async () => {
    const userId = 'user_test';

    // Make 100 requests (should succeed)
    for (let i = 0; i < 100; i++) {
      const res = await request.post('/community/posts').auth(userId);
      expect(res.status).toBe(201);
    }

    // Make 101st request (should fail)
    const res = await request.post('/community/posts').auth(userId);
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Rate limit exceeded');
  });

  it('should allow premium users to bypass', async () => {
    const premiumToken = generateToken({ tier: 'PREMIUM' });

    // Make 1000 posts
    for (let i = 0; i < 1000; i++) {
      const res = await request
        .post('/community/posts')
        .set('Authorization', `Bearer ${premiumToken}`);
      expect(res.status).toBe(201);
    }
  });

  it('should reset after 60 seconds', async () => {
    // Hit limit
    await hitLimitFor('user_test', 'POST:/community/posts');

    // Wait 61 seconds
    await sleep(61000);

    // Should succeed again
    const res = await request.post('/community/posts').auth('user_test');
    expect(res.status).toBe(201);
  });
});

```

---

**Last Updated:** 2026-02-11

## **Strategy:** IP → User → Endpoint. Bypass for premium/service accounts
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
