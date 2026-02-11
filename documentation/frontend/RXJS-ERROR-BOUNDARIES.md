# RxJS Error Boundaries & Resilience

## Overview

RxJS error handling prevents cascading failures. We use error boundaries to isolate failures per stream.

---

## Pattern: Error Boundary Operator

### Basic Error Boundary

```typescript
// apps/vlass-web/src/app/core/operators/error-boundary.operator.ts

import { Observable, catchError, of, throwError, timeout } from 'rxjs';
import { OperatorFunction } from 'rxjs';

export function errorBoundary<T>(
  fallbackValue: T,
  options?: {
    timeoutMs?: number;
    shouldRetry?: boolean;
    maxRetries?: number;
  },
): OperatorFunction<T, T> {
  return (source$: Observable<T>) => {
    let retryCount = 0;
    const maxRetries = options?.maxRetries ?? 3;

    return source$.pipe(
      // Timeout protection
      timeout(options?.timeoutMs ?? 30000),

      // Retry with exponential backoff
      catchError((error, caught) => {
        if (
          options?.shouldRetry &&
          retryCount < maxRetries &&
          isRetryableError(error)
        ) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
          return new Promise((resolve) =>
            setTimeout(() => resolve(caught), delay),
          ).then(() => caught);
        }

        // Log error (non-critical)
        console.error(`Error boundary caught:`, error);

        // Return fallback or throw
        if (fallbackValue !== undefined) {
          return of(fallbackValue);
        } else {
          return throwError(() => error);
        }
      }),
    );
  };
}

function isRetryableError(error: any): boolean {
  // Network errors, timeouts, 5xx are retryable
  // 4xx, validation errors are not
  return (
    error.status === undefined || // Network error
    error.status >= 500 || // Server error
    error.status === 408 // Request timeout
  );
}
```

### Usage Example

```typescript
// apps/vlass-web/src/app/tap/tap.service.ts

@Injectable()
export class TapService {
  constructor(private http: HttpClient) {}

  searchSources(ra: number, dec: number, radius: number): Observable<Source[]> {
    return this.http
      .get<Source[]>(`/api/tap-search?ra=${ra}&dec=${dec}&radius=${radius}`)
      .pipe(
        // If request fails, return empty list (not critical)
        errorBoundary([], {
          timeoutMs: 10000,
          shouldRetry: true,
          maxRetries: 2,
        }),

        // Tap side effect for logging
        map((sources) => {
          if (sources.length === 0) {
            console.warn(`No sources found for (${ra}, ${dec})`);
          }
          return sources;
        }),
      );
  }
}
```

---

## Pattern: Isolated Stream Subscriptions

Keep streams isolated to prevent one failure from breaking others:

```typescript
// apps/vlass-web/src/app/dashboard/dashboard.component.ts

@Component({
  selector: 'app-dashboard',
  template: `
    <div>
      <section *ngIf="posts$ | async as posts">
        {{ posts.length }} posts
      </section>

      <section *ngIf="users$ | async as users">
        {{ users.length }} users
      </section>

      <section *ngIf="stats$ | async as stats">
        {{ stats.totalViews }} views
      </section>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  posts$!: Observable<Post[]>;
  users$!: Observable<User[]>;
  stats$!: Observable<Stats>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    // Each stream is independent
    // If posts$ fails, users$ and stats$ continue

    this.posts$ = this.api.getPosts().pipe(
      errorBoundary([], {
        // Fallback: empty posts
        timeoutMs: 5000,
        shouldRetry: true,
      }),
    );

    this.users$ = this.api.getUsers().pipe(
      errorBoundary([], {
        // Fallback: empty users
        timeoutMs: 5000,
        shouldRetry: true,
      }),
    );

    this.stats$ = this.api.getStats().pipe(
      errorBoundary(
        { totalViews: 0 },
        {
          // Fallback: no stats
          timeoutMs: 5000,
        },
      ),
    );
  }
}
```

---

## Pattern: Error Recovery with Fallback

```typescript
// apps/vlass-web/src/app/core/api.service.ts

fetchDataWithFallback<T>(
  primary$: Observable<T>,
  fallback$: Observable<T>
): Observable<T> {
  return primary$.pipe(
    catchError((error) => {
      console.warn("Primary request failed, trying fallback", error);
      return fallback$;
    }),
    catchError((error) => {
      console.error("Both requests failed", error);
      return throwError(() => error);
    })
  );
}

// Usage: Try cache first, then API
this.data$ = this.fetchDataWithFallback(
  this.cache.get("posts"),
  this.http.get("/api/posts")
);
```

---

## Pattern: Circuit Breaker

Stop requesting a failing service temporarily:

```typescript
// apps/vlass-api/src/app/shared/guards/circuit-breaker.ts

@Injectable()
export class CircuitBreaker {
  private failures = new Map<string, number>(); // serviceName → count
  private openUntil = new Map<string, number>(); // serviceName → timestamp

  check(serviceName: string): void {
    const openTime = this.openUntil.get(serviceName);

    if (openTime && Date.now() < openTime) {
      throw new Error(`Circuit breaker open for ${serviceName}`);
    }

    this.openUntil.delete(serviceName);
  }

  recordFailure(serviceName: string): void {
    const count = (this.failures.get(serviceName) ?? 0) + 1;
    this.failures.set(serviceName, count);

    // Open circuit after 5 failures
    if (count >= 5) {
      const tripped = Date.now() + 60000; // 60 seconds
      this.openUntil.set(serviceName, tripped);
      this.failures.set(serviceName, 0);

      this.logger.error(`Circuit breaker OPEN for ${serviceName} (60s)`);
    }
  }

  recordSuccess(serviceName: string): void {
    this.failures.set(serviceName, 0);
  }
}
```

### Usage in Service

```typescript
@Injectable()
export class ExternalApiService {
  constructor(
    private http: HttpClient,
    private breaker: CircuitBreaker,
  ) {}

  callExternalService(): Observable<Data> {
    return this.http.get('/external/api').pipe(
      tap(() => {
        this.breaker.recordSuccess('external-api');
      }),
      catchError((error) => {
        this.breaker.recordFailure('external-api');

        // Try circuit breaker check (will throw if open)
        try {
          this.breaker.check('external-api');
        } catch (cbError) {
          return throwError(() => cbError);
        }

        return throwError(() => error);
      }),
      errorBoundary({ empty: true }),
    );
  }
}
```

---

## Pattern: Error Logging with Context

```typescript
// apps/vlass-web/src/app/core/logging/error-logger.service.ts

@Injectable({ providedIn: 'root' })
export class ErrorLogger {
  constructor(private http: HttpClient) {}

  logError(
    error: any,
    context: {
      component?: string;
      action?: string;
      userId?: string;
      correlationId?: string;
      data?: any;
    },
  ): void {
    const payload = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack,
      statusCode: error.status,
      context,
      userAgent: navigator.userAgent,
    };

    // Fire-and-forget error log (don't retry if fails)
    this.http
      .post('/api/logs/errors', payload)
      .pipe(
        timeout(5000),
        catchError(() => {
          // Fail silently
          console.error('Failed to log error', payload);
          return of(null);
        }),
      )
      .subscribe();
  }
}
```

### Usage

```typescript
this.api.getPosts().pipe(
  catchError((error) => {
    this.logger.logError(error, {
      component: 'PostListComponent',
      action: 'getPosts',
      userId: this.auth.userId,
      correlationId: this.corr.id,
    });
    return of([]);
  }),
);
```

---

## Testing Error Boundaries

```typescript
// apps/vlass-web/src/app/tap/tap.service.spec.ts

describe('TapService Error Handling', () => {
  it('should return fallback on API failure', async () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(TapService);

    const result = service.searchSources(200, 50, 1);

    const req = httpMock.expectOne((r) => r.url.includes('tap-search'));
    req.error(new ErrorEvent('Network error'), {
      status: 0,
    });

    result.subscribe((sources) => {
      expect(sources).toEqual([]); // Fallback
    });
  });

  it('should retry on server error', async () => {
    // Mock with delay to simulate retry
    let callCount = 0;

    const http = TestBed.inject(HttpClient);
    spyOn(http, 'get').and.callFake(() => {
      callCount++;
      if (callCount < 3) {
        return throwError(() => new Error('Server error'));
      }
      return of([{ id: 's1' }]);
    });

    const result = service.searchSources(200, 50, 1);

    result.subscribe((sources) => {
      expect(sources.length).toBe(1);
      expect(callCount).toBe(3); // 2 retries + 1 success
    });
  });
});
```

---

## Best Practices

1. **Always have a fallback** for non-critical streams
2. **Isolate subscriptions** — don't share error-prone streams
3. **Timeout aggressively** — prevent hanging requests
4. **Retry smartly** — only retryable errors (5xx, network)
5. **Log with context** — correlation ID, user, action
6. **Use circuit breaker** for external API dependencies
7. **Test error paths** — not just happy paths

---

**Last Updated:** 2026-02-06

**Key:** Isolate streams. Use fallbacks. Log with context. Retry smartly.
