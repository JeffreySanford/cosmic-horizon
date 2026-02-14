import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../services/auth-session.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let authSessionService: { isAuthenticated: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = {
      navigate: vi.fn(),
    };
    authSessionService = {
      isAuthenticated: vi.fn(),
    };
  });

  it('allows activation during SSR/server rendering', () => {
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: Router, useValue: router },
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    guard = TestBed.inject(AuthGuard);

    const result = guard.canActivate({} as never, { url: '/landing' } as never);

    expect(result).toBe(true);
    expect(authSessionService.isAuthenticated).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('allows authenticated browser users', () => {
    authSessionService.isAuthenticated.mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: Router, useValue: router },
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    guard = TestBed.inject(AuthGuard);

    const result = guard.canActivate({} as never, { url: '/landing' } as never);

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated browser users to login with returnUrl', () => {
    authSessionService.isAuthenticated.mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: Router, useValue: router },
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    guard = TestBed.inject(AuthGuard);

    const result = guard.canActivate({} as never, { url: '/landing' } as never);

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/landing' },
    });
  });
});
