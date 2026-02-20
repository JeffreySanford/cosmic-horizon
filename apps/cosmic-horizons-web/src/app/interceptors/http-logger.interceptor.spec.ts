import { TestBed } from '@angular/core/testing';
import {
  HttpHandler,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpLoggerInterceptor } from './http-logger.interceptor';
import { AppLoggerService } from '../services/app-logger.service';
import { AuthSessionService } from '../services/auth-session.service';
import { CorrelationService } from '../services/correlation.service';

class DummyLogger {
  info = vi.fn();
  error = vi.fn();
}

class DummySession {
  getUser() {
    return { id: 'u1', email: 'e', role: 'r' };
  }
}

describe('HttpLoggerInterceptor', () => {
  let interceptor: HttpLoggerInterceptor;
  let logger: DummyLogger;
  let session: DummySession;
  let correlation: Partial<CorrelationService> & Record<string, any>;
  let handler: HttpHandler;

  beforeEach(() => {
    logger = new DummyLogger();
    session = new DummySession();
    correlation = {
      getCorrelationId: vi.fn().mockReturnValue('cid-foo'),
      setCorrelationId: vi.fn(),
      correlationId$: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        HttpLoggerInterceptor,
        { provide: AppLoggerService, useValue: logger },
        { provide: AuthSessionService, useValue: session },
        { provide: CorrelationService, useValue: correlation },
      ],
    });
    interceptor = TestBed.inject(HttpLoggerInterceptor);
    handler = {
      handle: vi.fn(),
    } as unknown as HttpHandler;
  });

  it('should attach correlation header when service has id', async () => {
    const req = new HttpRequest<any>('GET' as any, '/test');
    const hMock = handler.handle as any;
    hMock.mockReturnValue(of(new HttpResponse({ status: 200 } as any)));

    await firstValueFrom(interceptor.intercept(req, handler));
    const calledReq: HttpRequest<any> = hMock.mock.calls[0][0];
    expect(calledReq.headers.get('X-Correlation-Id')).toBe('cid-foo');
  });

  it('should update correlation service from response header', async () => {
    const req = new HttpRequest<any>('GET' as any, '/test');
    const resp = new HttpResponse({ status: 200, headers: req.headers.set('x-correlation-id', 'resp-123') } as any);
    const hMock = handler.handle as any;
    hMock.mockReturnValue(of(resp));

    await firstValueFrom(interceptor.intercept(req, handler));
    expect(correlation.setCorrelationId).toHaveBeenCalledWith('resp-123');
  });

  it('should log errors with correlation id', async () => {
    const req = new HttpRequest<any>('POST' as any, '/foo');
    const err = new HttpErrorResponse({ status: 500, statusText: 'err' });
    const hMock = handler.handle as any;
    hMock.mockReturnValue(throwError(() => err));

    try {
      await firstValueFrom(interceptor.intercept(req, handler));
    } catch {
      // expected to throw
    }
    expect(logger.error).toHaveBeenCalledWith('http', 'http_error', expect.objectContaining({ correlation_id: 'cid-foo' }));
  });
});
