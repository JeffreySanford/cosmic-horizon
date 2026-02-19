import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, firstValueFrom } from 'rxjs';
import { AuthApiService } from '../features/auth/auth-api.service';
import { AuthSessionService } from '../services/auth-session.service';
import { AuthTokenInterceptor } from './auth-token.interceptor';

describe('AuthTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authSessionService: {
    getToken: ReturnType<typeof vi.fn>;
    getRefreshToken: ReturnType<typeof vi.fn>;
    setSession: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let authApiService: {
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authSessionService = {
      getToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setSession: vi.fn(),
      clearSession: vi.fn(),
    };
    authApiService = {
      refresh: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: AuthApiService, useValue: authApiService },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthTokenInterceptor,
          multi: true,
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches bearer token to non-auth API requests', async () => {
    authSessionService.getToken.mockReturnValue('token-123');

    const p = firstValueFrom(http.get('http://localhost:3000/api/posts'));

    const req = httpMock.expectOne('http://localhost:3000/api/posts');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush([]);

    await p;
  });

  it('does not attach token to login/register endpoints', async () => {
    authSessionService.getToken.mockReturnValue('token-123');

    const p1 = firstValueFrom(
      http.post('http://localhost:3000/api/auth/login', {
        email: 'a',
        password: 'b',
      }),
    );
    const p2 = firstValueFrom(
      http.post('http://localhost:3000/api/auth/register', {
        username: 'u',
        email: 'e',
        password: 'p',
      }),
    );

    const loginReq = httpMock.expectOne('http://localhost:3000/api/auth/login');
    const registerReq = httpMock.expectOne(
      'http://localhost:3000/api/auth/register',
    );

    expect(loginReq.request.headers.has('Authorization')).toBe(false);
    expect(registerReq.request.headers.has('Authorization')).toBe(false);
    loginReq.flush({});
    registerReq.flush({});

    await Promise.all([p1, p2]);
  });

  it('does not attach token to refresh endpoint', async () => {
    authSessionService.getToken.mockReturnValue('token-123');

    const p = firstValueFrom(
      http.post('http://localhost:3000/api/auth/refresh', {
        refresh_token: 'abc',
      }),
    );

    const req = httpMock.expectOne('http://localhost:3000/api/auth/refresh');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});

    await p;
  });

  it('does not attach token when not authenticated', async () => {
    authSessionService.getToken.mockReturnValue(null);

    const p = firstValueFrom(
      http.get('http://localhost:3000/api/view/telemetry'),
    );

    const req = httpMock.expectOne('http://localhost:3000/api/view/telemetry');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});

    await p;
  });

  it('refreshes token on 401 and retries once', () => {
    authSessionService.getToken.mockReturnValue('expired-token');
    authSessionService.getRefreshToken.mockReturnValue('refresh-token');
    authApiService.refresh.mockReturnValue(
      of({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        token_type: 'Bearer',
        user: {
          id: 'user-1',
          username: 'test',
          email: 'test@cosmic.local',
          display_name: 'Test',
          role: 'user',
          created_at: '2026-02-08T00:00:00.000Z',
        },
      }),
    );

    http.get('http://localhost:3000/api/posts').subscribe();

    const firstReq = httpMock.expectOne('http://localhost:3000/api/posts');
    expect(firstReq.request.headers.get('Authorization')).toBe(
      'Bearer expired-token',
    );
    firstReq.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authApiService.refresh).toHaveBeenCalledWith({
      refresh_token: 'refresh-token',
    });

    const retryReq = httpMock.expectOne('http://localhost:3000/api/posts');
    expect(retryReq.request.headers.get('Authorization')).toBe(
      'Bearer new-token',
    );
    expect(retryReq.request.headers.get('X-Auth-Retry')).toBe('1');
    retryReq.flush([]);

    expect(authSessionService.setSession).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'new-token',
      }),
    );
  });
});
