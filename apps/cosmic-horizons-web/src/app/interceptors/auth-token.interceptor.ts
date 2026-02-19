import { Injectable, inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { AuthApiService } from '../features/auth/auth-api.service';
import { AuthSessionService } from '../services/auth-session.service';

@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {
  private readonly authSessionService = inject(AuthSessionService);
  private readonly authApiService = inject(AuthApiService);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (this.shouldSkipAuth(req) || req.headers.has('Authorization')) {
      return next.handle(req);
    }

    const token = this.authSessionService.getToken();
    if (!token) {
      return next.handle(req);
    }

    const authedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next.handle(authedRequest).pipe(
      catchError((error: unknown) => {
        if (!this.shouldAttemptRefresh(req, error)) {
          return throwError(() => error);
        }

        const refreshToken = this.authSessionService.getRefreshToken();
        if (!refreshToken) {
          this.authSessionService.clearSession();
          return throwError(() => error);
        }

        return this.authApiService
          .refresh({ refresh_token: refreshToken })
          .pipe(
            switchMap((response) => {
              this.authSessionService.setSession(response);
              const retriedRequest = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${response.access_token}`,
                  'X-Auth-Retry': '1',
                },
              });
              return next.handle(retriedRequest);
            }),
            catchError((refreshError: unknown) => {
              this.authSessionService.clearSession();
              return throwError(() => refreshError);
            }),
          );
      }),
    );
  }

  private shouldSkipAuth(req: HttpRequest<unknown>): boolean {
    const url = req.url.toLowerCase();
    return (
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/github/callback')
    );
  }

  private shouldAttemptRefresh(
    req: HttpRequest<unknown>,
    error: unknown,
  ): error is HttpErrorResponse {
    if (this.shouldSkipAuth(req)) {
      return false;
    }

    if (req.headers.has('X-Auth-Retry')) {
      return false;
    }

    return error instanceof HttpErrorResponse && error.status === 401;
  }
}
