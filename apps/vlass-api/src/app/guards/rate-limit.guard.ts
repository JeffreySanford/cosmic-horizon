import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

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
  private readonly windowMs = Number(process.env['RATE_LIMIT_WINDOW_MS'] || 60_000);
  private readonly maxRequests = Number(process.env['RATE_LIMIT_MAX_WRITES'] || 30);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const key = this.keyFromRequest(request);
    const now = Date.now();
    const cutoff = now - this.windowMs;

    const current = this.windows.get(key) ?? { timestamps: [] };
    current.timestamps = current.timestamps.filter((timestamp) => timestamp > cutoff);

    if (current.timestamps.length >= this.maxRequests) {
      throw new HttpException(
        `Rate limit exceeded: max ${this.maxRequests} write requests per ${this.windowMs / 1000}s window.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.timestamps.push(now);
    this.windows.set(key, current);
    return true;
  }

  private keyFromRequest(request: HttpRequestLike): string {
    const forwarded = request.headers['x-forwarded-for'];
    const headerIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = headerIp?.split(',')[0].trim() || request.ip || 'unknown-ip';
    return `${ip}:${request.path}`;
  }
}
