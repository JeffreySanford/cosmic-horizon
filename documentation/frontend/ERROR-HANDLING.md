# Frontend Error Handling & Resilience

**Date:** 2026-02-07  
**Status:** MVP - Production Ready  
**Framework:** Angular 18 + RxJS + HttpClientModule  
**Pattern:** Centralized error handlers + error boundaries

---

## Table of Contents

1. [Error Handling Architecture](#error-handling-architecture)
2. [HTTP Error Handling](#http-error-handling)
3. [RxJS Error Boundaries](#rxjs-error-boundaries)
4. [User-Facing Error Messages](#user-facing-error-messages)
5. [Logging Errors](#logging-errors)
6. [Component Error States](#component-error-states)
7. [Testing Error Scenarios](#testing-error-scenarios)
8. [Error Recovery Strategies](#error-recovery-strategies)
9. [Common Errors & Solutions](#common-errors--solutions)

---

## Error Handling Architecture

### Error Types

```typescript
// Core error types used throughout the app

// 1. HTTP Errors (from API)
export interface HttpErrorResponse {
  status: number;           // 400, 401, 403, 404, 500, etc.
  statusText: string;       // "Bad Request", "Unauthorized"
  error: {
    message: string;        // User-friendly message
    code: string;          // Machine-readable error code
    details?: unknown;     // Additional context
  };
}

// 2. Validation Errors (from forms)
export interface ValidationError {
  field: string;           // Form field name (e.g., 'ra')
  message: string;         // What's wrong (e.g., 'Must be 0-360')
  code: string;           // Validation rule (e.g., 'range')
}

// 3. Custom Application Errors
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 4. Timeout Errors
export class TimeoutError extends Error {
  constructor(public timeout: number) {
    super(`Operation timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}
```

### Error Handling Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    USER ACTION                              │
│              (click, form submit, navigate)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
       ┌─────────────────┴─────────────────┐
       │                                   │
    Success                             Error
       │                                   │
       ▼                                   ▼
┌──────────────────┐              ┌────────────────────┐
│ API Call         │              │ Error Interceptor  │
│ (HTTP GET/POST)  │              │ (middleware)       │
└──────────────────┘              └────────────────────┘
       │                                   │
       ▼                                   ▼
   Response                    ┌──────────────────────┐
       │                       │ Error Classifier     │
       ▼                       │ (categorize issue)   │
   ├─ 2xx Success             └──────────────────────┘
   │   └─> Update state              │
   │       Notify user               ▼
   │       Log event         ┌──────────────────────┐
   │                         │ Error Logging        │
   │                         │ (console, backend)   │
   └─ 4xx Client Error       └──────────────────────┘
   │   └─> Validation error          │
   │       Form error msg      ▼
   │       Return focus    ┌──────────────────────┐
   │                       │ User Notification    │
   │                       │ (snackbar/modal)     │
   └─ 5xx Server Error     └──────────────────────┘
   │   └─> Retry logic            │
   │       Exponential backoff     ▼
   │       Max 3 retries    ┌──────────────────────┐
   │                        │ Fallback Action      │
   │                        │ (offline mode, cache)│
   └─ Network Error         └──────────────────────┘
       └─> Offline mode
           Use cached data
           Queue requests
```

---

## HTTP Error Handling

### HTTP Interceptor

```typescript
// services/http-error-interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(
    private notification: NotificationService,
    private logging: LoggingService
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      // Timeout after 30 seconds
      timeout(30000),
      
      // Retry on 5xx errors up to 3 times with exponential backoff
      retry({
        count: 3,
        delay: (error: unknown, count: number) => {
          if (
            error instanceof HttpErrorResponse &&
            error.status >= 500
          ) {
            // Exponential backoff: 1s, 2s, 4s
            const backoffMs = Math.pow(2, count) * 1000;
            console.warn(
              `Retrying request (attempt ${count}), backoff ${backoffMs}ms`
            );
            return timer(backoffMs);
          }
          return throwError(() => error);
        }
      }),
      
      // Handle errors
      catchError((error: unknown) => {
        return this.handleError(error, request);
      })
    );
  }

  private handleError(
    error: unknown,
    request: HttpRequest<unknown>
  ): Observable<never> {
    let appError: AppError;

    if (error instanceof HttpErrorResponse) {
      appError = this.handleHttpError(error, request);
    } else if (error instanceof TimeoutError) {
      appError = this.handleTimeoutError(error);
    } else {
      appError = new AppError(
        'UNKNOWN_ERROR',
        'An unexpected error occurred',
        500
      );
    }

    // Log error to backend
    this.logging.logError({
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      context: appError.context
    });

    // Show user-friendly message
    this.notification.showError(appError.message);

    return throwError(() => appError);
  }

  private handleHttpError(
    error: HttpErrorResponse,
    request: HttpRequest<unknown>
  ): AppError {
    const status = error.status;
    const message = error.error?.message || error.statusText;

    // Specific handling by status code
    if (status === 0) {
      return new AppError(
        'NETWORK_ERROR',
        'Unable to reach server. Check your internet connection.',
        0
      );
    }

    if (status === 401) {
      // Unauthorized - redirect to login
      window.location.href = '/auth/login';
      return new AppError(
        'UNAUTHORIZED',
        'Your session has expired. Please log in again.',
        401
      );
    }

    if (status === 403) {
      return new AppError(
        'FORBIDDEN',
        'You do not have permission to access this resource.',
        403
      );
    }

    if (status === 404) {
      return new AppError(
        'NOT_FOUND',
        `The requested resource was not found (${request.url}).`,
        404
      );
    }

    if (status === 409) {
      // Conflict (e.g., duplicate entry)
      return new AppError(
        'CONFLICT',
        message || 'This resource already exists. Please use a different name.',
        409
      );
    }

    if (status === 429) {
      // Rate limit
      return new AppError(
        'RATE_LIMITED',
        'Too many requests. Please wait a moment and try again.',
        429
      );
    }

    if (status >= 400 && status < 500) {
      // Client errors (4xx)
      return new AppError(
        'CLIENT_ERROR',
        message || 'There was a problem with your request.',
        status
      );
    }

    if (status >= 500) {
      // Server errors (5xx)
      return new AppError(
        'SERVER_ERROR',
        'The server encountered an error. Please try again later.',
        status
      );
    }

    return new AppError(
      'UNKNOWN_ERROR',
      'An unexpected error occurred.',
      status
    );
  }

  private handleTimeoutError(error: TimeoutError): AppError {
    return new AppError(
      'TIMEOUT',
      `The request took too long (${error.timeout}ms). Please check your connection and try again.`,
      0
    );
  }
}
```

### Registering the Interceptor

```typescript
// app.config.ts
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpErrorInterceptor } from './services/http-error-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    HttpClientModule,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpErrorInterceptor,
      multi: true
    }
  ]
};
```

### Example API Call with Error Handling

```typescript
// services/viewer-api.service.ts
@Injectable({ providedIn: 'root' })
export class ViewerApiService {
  constructor(
    private http: HttpClient,
    private storage: StorageService
  ) {}

  // Get viewer state by short ID
  getViewerState(shortId: string): Observable<ViewerStateModel> {
    return this.http.get<ViewerStateModel>(
      `/api/v1/viewer/state/${shortId}`
    ).pipe(
      tap(state => {
        // Cache successful state
        this.storage.setViewerState(shortId, state);
      }),
      catchError(error => {
        // Try to return cached version
        const cached = this.storage.getViewerState(shortId);
        if (cached) {
          console.warn('Using cached viewer state', shortId);
          return of(cached);
        }
        // Re-throw error if no cache available
        throw error;
      })
    );
  }

  // Download FITS cutout
  downloadFitsCutout(params: FitsParams): Observable<Blob> {
    return this.http.post<Blob>(
      '/api/v1/viewer/cutout',
      params,
      {
        responseType: 'blob' as 'json'
      }
    ).pipe(
      tap(blob => {
        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cutout-${params.ra}-${params.dec}.fits`;
        link.click();
        window.URL.revokeObjectURL(url);
      })
    );
  }
}
```

---

## RxJS Error Boundaries

### Error Boundary Service

```typescript
// services/error-boundary.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ErrorBoundaryService {
  constructor(private logging: LoggingService) {}

  /**
   * Wrap observable with error handling
   * @param source Observable to wrap
   * @param fallback Fallback value if error occurs
   * @param context Error context for logging
   */
  wrapObservable<T>(
    source: Observable<T>,
    fallback: T,
    context: string
  ): Observable<T> {
    return source.pipe(
      catchError(error => {
        this.logging.logError({
          code: 'OBSERVABLE_ERROR',
          message: `Error in ${context}`,
          context: { originalError: error }
        });
        return of(fallback);
      })
    );
  }

  /**
   * Track observable with error logging
   */
  track<T>(
    source: Observable<T>,
    name: string
  ): Observable<T> {
    return source.pipe(
      tap({
        next: () => {
          this.logging.logInfo(`${name} completed successfully`);
        },
        error: (error) => {
          this.logging.logError({
            code: 'TRACKED_ERROR',
            message: `Error in ${name}`,
            context: { error }
          });
        }
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  /**
   * Retry with exponential backoff
   */
  retryWithBackoff<T>(
    source: Observable<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Observable<T> {
    return source.pipe(
      retry({
        count: maxRetries,
        delay: (error, count) => {
          const delay = baseDelay * Math.pow(2, count - 1);
          console.warn(
            `Retrying after ${delay}ms (attempt ${count}/${maxRetries})`
          );
          return timer(delay);
        }
      }),
      catchError(error => {
        console.error(`Failed after ${maxRetries} retries`, error);
        throw error;
      })
    );
  }
}
```

### Usage in Components

```typescript
// viewer.component.ts
export class ViewerComponent implements OnInit {
  state$ = new BehaviorSubject<ViewerState | null>(null);
  isLoading$ = new BehaviorSubject(false);
  error$ = new BehaviorSubject<AppError | null>(null);

  constructor(private viewerApi: ViewerApiService) {}

  ngOnInit() {
    const shortId = this.route.snapshot.paramMap.get('shortId');
    if (!shortId) return;

    this.isLoading$.next(true);

    // Load viewer state with error handling
    this.viewerApi.getViewerState(shortId)
      .pipe(
        tap(state => {
          this.state$.next(state);
          this.error$.next(null);
        }),
        catchError(error => {
          this.error$.next(error);
          this.state$.next(null);
          return EMPTY;
        }),
        finalize(() => this.isLoading$.next(false))
      )
      .subscribe();
  }

  // Safe observable composition
  nearbyObjects$ = this.state$.pipe(
    switchMap(state => {
      if (!state) return of(null);
      
      return this.viewerApi.getNearby(
        state.ra,
        state.dec,
        state.radius
      ).pipe(
        // Retry network errors
        retry({
          count: 2,
          delay: (error) => {
            if (error instanceof HttpErrorResponse && error.status === 0) {
              return timer(1000);
            }
            return throwError(() => error);
          }
        }),
        catchError(error => {
          console.error('Failed to load nearby objects', error);
          return of(null);
        })
      );
    })
  );
}
```

---

## User-Facing Error Messages

### Error Message Patterns

```typescript
// services/error-message.service.ts
import { Injectable } from '@angular/core';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  /**
   * Convert error to user-friendly message
   */
  getMessage(error: unknown): string {
    if (error instanceof AppError) {
      return this.getAppErrorMessage(error);
    }
    if (error instanceof HttpErrorResponse) {
      return this.getHttpErrorMessage(error);
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }

  private getAppErrorMessage(error: AppError): string {
    const messages: Record<string, string> = {
      'NETWORK_ERROR': 'Connection failed. Check your internet.',
      'UNAUTHORIZED': 'Please log in to continue.',
      'FORBIDDEN': 'You do not have permission.',
      'NOT_FOUND': 'Resource not found.',
      'VALIDATION_ERROR': 'Please check your input.',
      'TIMEOUT': 'Request took too long. Try again.',
      'RATE_LIMITED': 'Too many requests. Wait and try again.',
      'SERVER_ERROR': 'Server error. Try again later.'
    };
    
    return messages[error.code] || error.message;
  }

  private getHttpErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Unable to connect to the server.';
    }
    if (error.status === 401) {
      return 'Your session expired. Please log in again.';
    }
    if (error.status === 403) {
      return 'You do not have access to this resource.';
    }
    if (error.status === 404) {
      return 'The requested resource was not found.';
    }
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
    return error.error?.message || 'An error occurred.';
  }

  /**
   * Get error-specific action suggestions
   */
  getSuggestion(error: AppError): string | null {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'Check your internet connection and try again.';
      case 'UNAUTHORIZED':
        return 'Log in with your credentials.';
      case 'RATE_LIMITED':
        return 'Wait a few seconds before making another request.';
      case 'TIMEOUT':
        return 'Check your connection. The server may be slow.';
      default:
        return null;
    }
  }
}
```

### Notification Service

```typescript
// services/notification.service.ts
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  showError(message: string, action = 'Dismiss', duration = 5000) {
    this.snackBar.open(message, action, {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }

  showSuccess(message: string, action = 'Dismiss', duration = 3000) {
    this.snackBar.open(message, action, {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['success-snackbar']
    });
  }

  showWarning(message: string, action = 'Dismiss', duration = 4000) {
    this.snackBar.open(message, action, {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['warning-snackbar']
    });
  }

  showInfo(message: string, action = 'Dismiss', duration = 3000) {
    this.snackBar.open(message, action, {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['info-snackbar']
    });
  }
}
```

---

## Logging Errors

### Error Logging Integration

```typescript
// services/logging.service.ts
@Injectable({ providedIn: 'root' })
export class LoggingService {
  constructor(private http: HttpClient) {}

  logError(errorData: {
    code: string;
    message: string;
    statusCode?: number;
    url?: string;
    method?: string;
    context?: Record<string, unknown>;
    timestamp?: string;
  }) {
    const payload = {
      ...errorData,
      timestamp: errorData.timestamp || new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Log to console in development
    if (!environment.production) {
      console.error('[ERROR]', payload.code, payload.message, payload);
    }

    // Send to backend logging service
    this.http.post(
      '/api/v1/logs/error',
      payload
    ).subscribe({
      error: () => {
        // Silently fail - don't cascade error logging errors
        console.error('Failed to log error to backend', payload);
      }
    });
  }

  logWarning(message: string, context?: Record<string, unknown>) {
    console.warn('[WARNING]', message, context);
    
    this.http.post('/api/v1/logs/warning', {
      message,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href
    }).subscribe({
      error: () => console.error('Failed to log warning')
    });
  }

  logInfo(message: string) {
    if (!environment.production) {
      console.log('[INFO]', message);
    }
  }
}
```

---

## Component Error States

### Error State Template

```html
<!-- viewer.component.html -->

<!-- Loading state -->
@if (isLoading$ | async) {
  <div class="loading-spinner">
    <mat-spinner></mat-spinner>
    <p>Loading viewer...</p>
  </div>
}

<!-- Error state -->
@else if (error$ | async as error) {
  <div class="error-container">
    <mat-card class="error-card">
      <mat-card-header>
        <mat-icon class="error-icon">error_outline</mat-icon>
        <mat-card-title>Unable to Load Viewer</mat-card-title>
      </mat-card-header>
      
      <mat-card-content>
        <p class="error-message">{{ error.message }}</p>
        
        @if (error.code === 'NOT_FOUND') {
          <p class="error-hint">
            The viewer state you requested was not found.
            Try starting from the home page.
          </p>
        }
        
        @if (error.code === 'NETWORK_ERROR' {
          <p class="error-hint">
            Check your internet connection and try again.
          </p>
        }
      </mat-card-content>
      
      <mat-card-actions>
        <button mat-raised-button color="primary" routerLink="/">
          <mat-icon>home</mat-icon>
          Home
        </button>
        <button mat-stroked-button (click)="retry()">
          <mat-icon>refresh</mat-icon>
          Retry
        </button>
      </mat-card-actions>
    </mat-card>
  </div>
}

<!-- Success state -->
@else if (state$ | async as state) {
  <div class="viewer-container">
    <!-- Viewer content -->
  </div>
}
```

### Component Logic

```typescript
export class ViewerComponent implements OnInit {
  error$ = new BehaviorSubject<AppError | null>(null);
  isLoading$ = new BehaviorSubject(false);
  state$ = new BehaviorSubject<ViewerState | null>(null);

  constructor(
    private viewerApi: ViewerApiService,
    private route: ActivatedRoute,
    private notification: NotificationService
  ) {}

  ngOnInit() {
    this.loadViewerState();
  }

  private loadViewerState() {
    const shortId = this.route.snapshot.paramMap.get('shortId');
    if (!shortId) {
      this.error$.next(
        new AppError('NOT_FOUND', 'No viewer state specified')
      );
      return;
    }

    this.isLoading$.next(true);

    this.viewerApi.getViewerState(shortId)
      .pipe(
        tap(state => {
          this.state$.next(state);
          this.error$.next(null);
        }),
        catchError(error => {
          this.error$.next(error);
          this.state$.next(null);
          return EMPTY;
        }),
        finalize(() => this.isLoading$.next(false))
      )
      .subscribe();
  }

  // Allow user to retry
  retry() {
    this.loadViewerState();
  }
}
```

---

## Testing Error Scenarios

### Unit Test Examples

```typescript
// viewer.component.spec.ts
describe('ViewerComponent - Error Handling', () => {
  let component: ViewerComponent;
  let fixture: ComponentFixture<ViewerComponent>;
  let viewerApi: jasmine.SpyObj<ViewerApiService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('ViewerApiService', [
      'getViewerState'
    ]);

    await TestBed.configureTestingModule({
      declarations: [ViewerComponent],
      providers: [
        { provide: ViewerApiService, useValue: spy }
      ]
    }).compileComponents();

    viewerApi = TestBed.inject(
      ViewerApiService
    ) as jasmine.SpyObj<ViewerApiService>;
  });

  it('should display error message on 404', fakeAsync(() => {
    const error = new AppError(
      'NOT_FOUND',
      'Viewer state not found',
      404
    );
    viewerApi.getViewerState.and.returnValue(
      throwError(() => error)
    );

    component.ngOnInit();
    tick();
    fixture.detectChanges();

    expect(component.error$.value).toBe(error);
    expect(fixture.debugElement.query(
      By.css('.error-container')
    )).toBeTruthy();
  }));

  it('should retry when retry button clicked', fakeAsync(() => {
    const error = new AppError('NETWORK_ERROR', 'Network failed');
    viewerApi.getViewerState.and.returnValue(
      throwError(() => error)
    );

    component.ngOnInit();
    tick();

    // Simulate successful retry
    const mockState: ViewerState = {
      ra: 100,
      dec: 50,
      fov: 1
    };
    viewerApi.getViewerState.and.returnValue(of(mockState));

    component.retry();
    tick();

    expect(component.state$.value).toEqual(mockState);
    expect(component.error$.value).toBeNull();
  }));

  it('should show spinner while loading', fakeAsync(() => {
    viewerApi.getViewerState.and.returnValue(
      timer(1000).pipe(map(() => mockState))
    );

    component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.debugElement.query(
      By.css('.loading-spinner')
    )).toBeTruthy();

    tick(1000);
    fixture.detectChanges();

    expect(fixture.debugElement.query(
      By.css('.loading-spinner')
    )).toBeFalsy();
  }));
});
```

### HTTP Interceptor Tests

```typescript
// http-error-interceptor.spec.ts
describe('HttpErrorInterceptor', () => {
  let httpTestingController: HttpTestingController;
  let httpClient: HttpClient;
  let notification: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    const notificationSpy = jasmine.createSpyObj(
      'NotificationService',
      ['showError']
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        HttpErrorInterceptor,
        { 
          provide: HTTP_INTERCEPTORS,
          useClass: HttpErrorInterceptor,
          multi: true
        },
        { 
          provide: NotificationService, 
          useValue: notificationSpy 
        }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    notification = TestBed.inject(
      NotificationService
    ) as jasmine.SpyObj<NotificationService>;
  });

  it('should handle 401 Unauthorized', () => {
    httpClient.get('/api/test').subscribe({
      error: (error: AppError) => {
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    const req = httpTestingController.expectOne('/api/test');
    req.flush('Unauthorized', {
      status: 401,
      statusText: 'Unauthorized'
    });

    expect(notification.showError).toHaveBeenCalled();
  });

  it('should retry on 500 error', () => {
    let attempt = 0;
    
    httpClient.get('/api/test').subscribe();

    for (let i = 0; i < 3; i++) {
      const req = httpTestingController.expectOne('/api/test');
      attempt++;
      
      if (i < 2) {
        // Fail first 2 attempts
        req.flush('Server Error', {
          status: 500,
          statusText: 'Server Error'
        });
      } else {
        // Succeed on 3rd attempt
        req.flush({ data: 'success' });
      }
    }

    expect(attempt).toBe(3);
  });
});
```

---

## Error Recovery Strategies

### Offline Mode (Future Enhancement)

```typescript
// services/offline.service.ts
@Injectable({ providedIn: 'root' })
export class OfflineService {
  isOnline$ = new BehaviorSubject(navigator.onLine);
  
  constructor(
    private notification: NotificationService,
    private storage: StorageService
  ) {
    window.addEventListener('online', () => {
      this.isOnline$.next(true);
      this.notification.showInfo('Connection restored');
      this.syncQueuedRequests();
    });

    window.addEventListener('offline', () => {
      this.isOnline$.next(false);
      this.notification.showWarning('Working offline');
    });
  }

  // Queue requests while offline
  queueRequest(request: HttpRequest<any>) {
    const queue = this.storage.getOfflineQueue() || [];
    queue.push({
      url: request.url,
      method: request.method,
      body: request.body,
      timestamp: Date.now()
    });
    this.storage.setOfflineQueue(queue);
  }

  // Sync when online
  private syncQueuedRequests() {
    const queue = this.storage.getOfflineQueue() || [];
    // Send queued requests...
  }
}
```

### Caching Strategy

```typescript
// services/cache.service.ts
@Injectable({ providedIn: 'root' })
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  // Use cache as fallback
  getWithFallback<T>(
    source: Observable<T>,
    cacheKey: string
  ): Observable<T> {
    const cached = this.get<T>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return source.pipe(
      tap(value => this.set(cacheKey, value)),
      catchError(() => {
        const fallback = this.get<T>(cacheKey);
        if (fallback) {
          return of(fallback);
        }
        throw new AppError(
          'CACHE_MISS',
          'Data not available and cache expired'
        );
      })
    );
  }
}
```

---

## Common Errors & Solutions

### Problem: Form validation errors not showing

**Symptom:** User submits form with invalid data, but no error message appears.

**Solution:**

```typescript
// contact-form.component.ts
onSubmit() {
  if (this.form.invalid) {
    // Mark all fields as touched to show errors
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });
    
    this.notification.showError('Please fix the errors below');
    return;
  }

  // Submit form...
}
```

### Problem: Race conditions with multiple API calls

**Symptom:** User navigates rapidly, causing multiple requests; last one to complete wins (stale data).

**Solution:**

```typescript
// Use switchMap to cancel previous requests
public search$ = new Subject<string>();
public searchResults$ = this.search$.pipe(
  debounceTime(300),
  switchMap(query => this.api.search(query)), // Cancels previous
  catchError(() => of([]))
);
```

### Problem: Memory leaks from subscriptions

**Symptom:** Component subscribes but doesn't unsubscribe; old subscriptions pile up.

**Solution:**

```typescript
// Use async pipe in template (auto-unsubscribe)
@Component({
  template: '{{ data$ | async }}'  // ✓ Auto-unsubscribe
})
export class MyComponent {
  data$ = this.api.getData();
}

// OR use takeUntilDestroyed
export class MyComponent implements OnInit {
  destroy$ = new Subject<void>();

  ngOnInit() {
    this.data$.pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
  }
}
```

### Problem: Lost error context

**Symptom:** Error caught deep in call stack, original context lost.

**Solution:**

```typescript
// Add context at each level
this.api.call()
  .pipe(
    catchError(error => {
      throw new AppError(
        'API_CALL_FAILED',
        error.message,
        error.statusCode || 500,
        {
          endpoint: '/api/endpoint',
          originalError: error
        }
      );
    })
  )
  .subscribe();
```

---

**Last Updated:** 2026-02-07  
**Maintained By:** VLASS Portal Development Team

**Related Documentation:**

- [FRONTEND-OVERVIEW.md](FRONTEND-OVERVIEW.md) - Architecture overview
- [VIEWER-CONTROLS.md](VIEWER-CONTROLS.md) - Viewer control details
- [COMPONENTS.md](COMPONENTS.md) - Component catalog
