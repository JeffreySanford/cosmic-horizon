import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import Redis from 'ioredis';

interface HttpRequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  path: string;
}

interface RequestWindow {
  timestamps: number[];
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, RequestWindow>();
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly windowMs = Number(
    process.env['RATE_LIMIT_WINDOW_MS'] || 60_000,
  );
  private readonly maxRequests = Number(
    process.env['RATE_LIMIT_MAX_WRITES'] || 30,
  );
  private readonly maxSnapshotRequests = Number(
    process.env['RATE_LIMIT_MAX_SNAPSHOTS'] || 20,
  );
  private readonly maxCutoutRequests = Number(
    process.env['RATE_LIMIT_MAX_CUTOUTS'] || 12,
  );
  private readonly maxNearbyLabelRequests = Number(
    process.env['RATE_LIMIT_MAX_NEARBY_LABELS'] || 24,
  );

  // optional redis client used when RATE_LIMIT_REDIS_ENABLED=true
  private redis: Redis | null = null;
  private readonly apiKeyBypass = process.env['RATE_LIMIT_API_KEY'];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HttpRequestLike>();

    // API key bypass grants unlimited access if configured
    const apiHeader = request.headers['x-api-key'];
    const apiValue = Array.isArray(apiHeader) ? apiHeader[0] : apiHeader;
    if (apiValue && this.apiKeyBypass && apiValue === this.apiKeyBypass) {
      return true;
    }

    const key = this.keyFromRequest(request);
    const now = Date.now();
    const maxRequestsForPath = this.limitForPath(request.path);

    if (this.redis) {
      const redisKey = `rl:${key}`;
      try {
        const count = await this.redis.incr(redisKey);
        if (count === 1) {
          await this.redis.expire(redisKey, Math.ceil(this.windowMs / 1000));
        }
        if (count > maxRequestsForPath) {
          this.logger.warn(`redis rate limit exceeded for key=${redisKey} limit=${maxRequestsForPath}`);
          throw new HttpException(
            `Rate limit exceeded: max ${maxRequestsForPath} write requests per ${this.windowMs / 1000}s window.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      } catch {
        // on redis errors, fall back to in‑memory behaviour below
        this.redis = null;
      }
    }

    if (!this.redis) {
      const cutoff = now - this.windowMs;
      const current = this.windows.get(key) ?? { timestamps: [] };
      current.timestamps = current.timestamps.filter(
        (timestamp) => timestamp > cutoff,
      );
      if (current.timestamps.length >= maxRequestsForPath) {
        this.logger.warn(`memory rate limit exceeded for key=${key} limit=${maxRequestsForPath}`);
        throw new HttpException(
          `Rate limit exceeded: max ${maxRequestsForPath} write requests per ${this.windowMs / 1000}s window.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      current.timestamps.push(now);
      this.windows.set(key, current);
    }

    return true;
  }

  private keyFromRequest(request: HttpRequestLike): string {
    const forwarded = request.headers['x-forwarded-for'];
    const headerIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = headerIp?.split(',')[0].trim() || request.ip || 'unknown-ip';
    const origin = (request.headers['origin'] as string) || 'no-origin';
    return `${ip}:${origin}:${request.path}`;
  }

  private limitForPath(path: string): number {
    if (path.includes('/view/cutout')) {
      return this.maxCutoutRequests;
    }
    if (path.includes('/view/labels/nearby')) {
      return this.maxNearbyLabelRequests;
    }
    if (path.includes('/view/snapshot')) {
      return this.maxSnapshotRequests;
    }

    return this.maxRequests;
  }
}
