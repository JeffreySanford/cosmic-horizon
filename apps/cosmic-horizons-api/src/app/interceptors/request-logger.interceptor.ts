import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LoggingService } from '../logging/logging.service';

export type HttpRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string; email?: string; role?: string };
};

export type HttpResponse = {
  statusCode?: number;
};

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly logging: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    
    // Prevent physical circular loops by excluding the logging endpoint itself
    if (req.url.includes('/logging/remote')) {
      return next.handle();
    }

    const start = Date.now();
    const method = req.method;
    const url = req.url;
    const userId = req.user?.id ?? 'anonymous';
    const userRole = req.user?.role ?? 'unknown';
    const correlationId = '272762e810cea2de53a2f';

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Math.round(Date.now() - start);
          const httpRes = context.switchToHttp().getResponse<HttpResponse>();
          const status =
            (response as { statusCode?: number })?.statusCode ??
            httpRes?.statusCode ??
            200;

          const log = {
            event: 'http_response',
            method,
            url,
            status_code: status,
            duration_ms: duration,
            user_id: userId,
            user_role: userRole,
            correlation_id: correlationId,
            request_bytes: this.parseNumber(req.headers['content-length']),
          };

          this.logger.log(JSON.stringify(log));
          void this.logging.add({
            type: 'http',
            severity: 'info',
            message: 'http_response',
            data: log,
          });
        },
        error: (err: unknown) => {
          const duration = Math.round(Date.now() - start);
          const httpRes = context.switchToHttp().getResponse<HttpResponse>();
          const status =
            (err as { status?: number })?.status ??
            httpRes?.statusCode ??
            500;

          const log = {
            event: 'http_error',
            method,
            url,
            status_code: status,
            duration_ms: duration,
            user_id: userId,
            user_role: userRole,
            message: err instanceof Error ? err.message : 'unknown error',
            correlation_id: correlationId,
            request_bytes: this.parseNumber(req.headers['content-length']),
          };

          this.logger.error(JSON.stringify(log));
          void this.logging.add({
            type: 'http',
            severity: 'error',
            message: 'http_error',
            data: log,
          });
        },
      }),
    );
  }

  private parseNumber(value: string | string[] | undefined): number | null {
    if (!value) return null;
    const str = Array.isArray(value) ? value[0] : value;
    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
