import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerationGuard } from './moderation.guard';
import { AuthApiService } from '../features/auth/auth-api.service';
import { AuthSessionService } from '../services/auth-session.service';

describe('ModerationGuard', () => {
  let guard: ModerationGuard;
  let authSessionService: { getRole: ReturnType<typeof vi.fn> };
  let authApiService: { getMe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authSessionService = { getRole: vi.fn() } as any;
    authApiService = { getMe: vi.fn() } as any;

    TestBed.configureTestingModule({
      providers: [
        ModerationGuard,
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: AuthApiService, useValue: authApiService },
      ],
    });

    guard = TestBed.inject(ModerationGuard);
  });

  it('redirects guest to login', () => {
    authSessionService.getRole.mockReturnValue('guest');
    const res = guard.canActivate();
    expect(res).toBe(false);
  });

  it('allows admin when backend confirms role', async () => {
    authSessionService.getRole.mockReturnValue('admin');
    authApiService.getMe.mockReturnValue(of({ user: { role: 'admin' } }));

    const stream = guard.canActivate();
    const result = typeof stream === 'boolean' ? stream : await firstValueFrom(stream as any);

    expect(result).toBe(true);
  });

  it('allows moderator when backend confirms role', async () => {
    authSessionService.getRole.mockReturnValue('moderator');
    authApiService.getMe.mockReturnValue(of({ user: { role: 'moderator' } }));

    const stream = guard.canActivate();
    const result = typeof stream === 'boolean' ? stream : await firstValueFrom(stream as any);

    expect(result).toBe(true);
  });

  it('blocks non-moderator/admin users', async () => {
    authSessionService.getRole.mockReturnValue('user');
    authApiService.getMe.mockReturnValue(of({ user: { role: 'user' } }));

    const stream = guard.canActivate();
    const result = typeof stream === 'boolean' ? stream : await firstValueFrom(stream as any);

    expect(result).toBe(false);
  });
});

