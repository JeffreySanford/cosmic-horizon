import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../features/auth/auth-api.service';
import { AuthSessionService } from '../services/auth-session.service';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let authApiService: { getMe: ReturnType<typeof vi.fn> };
  let authSessionService: { getRole: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = {
      navigate: vi.fn(),
    };
    authApiService = {
      getMe: vi.fn(),
    };
    authSessionService = {
      getRole: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminGuard,
        { provide: Router, useValue: router },
        { provide: AuthApiService, useValue: authApiService },
        { provide: AuthSessionService, useValue: authSessionService },
      ],
    });

    guard = TestBed.inject(AdminGuard);
  });

  it('allows admin when backend confirms role', async () => {
    authSessionService.getRole.mockReturnValue('admin');
    authApiService.getMe.mockReturnValue(
      of({
        authenticated: true,
        user: {
          id: 'admin-id',
          username: 'admin',
          email: 'admin@cosmic.local',
          display_name: 'Admin',
          role: 'admin',
          created_at: '2026-02-08T00:00:00.000Z',
        },
      }),
    );

    const stream = guard.canActivate();
    const result = typeof stream === 'boolean' ? stream : await firstValueFrom(stream);

    expect(result).toBe(true);
    expect(authApiService.getMe).toHaveBeenCalledWith();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects non-admin user to landing', async () => {
    authSessionService.getRole.mockReturnValue('user');
    authApiService.getMe.mockReturnValue(
      of({
        authenticated: true,
        user: {
          id: 'user-id',
          username: 'user',
          email: 'test@cosmic.local',
          display_name: 'User',
          role: 'user',
          created_at: '2026-02-08T00:00:00.000Z',
        },
      }),
    );

    const stream = guard.canActivate();
    const result = typeof stream === 'boolean' ? stream : await firstValueFrom(stream);

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/landing']);
  });

  it('redirects to login when token is missing', () => {
    authSessionService.getRole.mockReturnValue('guest');

    const result = guard.canActivate();

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('redirects to login when backend auth check fails', async () => {
    authSessionService.getRole.mockReturnValue('user');
    authApiService.getMe.mockReturnValue(throwError(() => new Error('unauthorized')));

    const stream = guard.canActivate();
    const result = typeof stream === 'boolean' ? stream : await firstValueFrom(stream);

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
