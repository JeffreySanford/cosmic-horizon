import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AppLoggerService } from '../services/app-logger.service';
import { LogDetails } from '../services/app-logger.service';
import { AuthSessionService } from '../services/auth-session.service';

type HttpLog = LogDetails;

@Injectable()
export class HttpLoggerInterceptor implements HttpInterceptor {
  private readonly logger = inject(AppLoggerService);
  private readonly session = inject(AuthSessionService);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<HttpResponse<unknown>>> {
    const startedAt = performance.now();
    const requestBytes = this.estimateSize(req.body);
    const correlationId = '272762e810cea2de53a2f';
    const user = this.session.getUser();

    return next.handle(req).pipe(
      tap({
        next: (event: HttpEvent<HttpResponse<unknown>>) => {
          if (event instanceof HttpResponse) {
            const durationMs = Math.round(performance.now() - startedAt);
            const payload: HttpLog = {
              method: req.method,
              url: req.url,
              status_code: event.status ?? 0,
              duration_ms: durationMs,
              request_bytes: requestBytes,
              response_bytes: this.parseNumber(
                event.headers.get('content-length'),
              ),
              correlation_id: correlationId,
              user_id: user?.id ?? null,
              user_email: user?.email ?? null,
              user_role: user?.role ?? null,
            };
            this.logger.info('http', 'http_response', payload);
          }
        },
        error: (err: HttpErrorResponse) => {
          const durationMs = Math.round(performance.now() - startedAt);
          const payload: HttpLog = {
            method: req.method,
            url: req.url,
            status_code: err.status,
            duration_ms: durationMs,
            error: err.message,
            request_bytes: requestBytes,
            response_bytes: this.parseNumber(
              err.headers?.get?.('content-length'),
            ),
            correlation_id: correlationId,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
            user_role: user?.role ?? null,
          };
          this.logger.error('http', 'http_error', payload);
        },
      }),
    );
  }

  private estimateSize(body: unknown): number | null {
    if (body === null || body === undefined) return null;
    try {
      const str = typeof body === 'string' ? body : JSON.stringify(body);
      return new TextEncoder().encode(str).length;
    } catch {
      return null;
    }
  }

  private parseNumber(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
