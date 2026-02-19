import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../auth-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';
import { SkyPreviewService } from '../../../services/sky-preview.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let authApiService: { register: ReturnType<typeof vi.fn> };
  let authSessionService: { setSession: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    authApiService = {
      register: vi.fn(),
    };

    authSessionService = {
      setSession: vi.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [RegisterComponent],
      imports: [RouterTestingModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthApiService,
          useValue: authApiService,
        },
        {
          provide: AuthSessionService,
          useValue: authSessionService,
        },
        {
          provide: SkyPreviewService,
          useValue: {
            getInitialPreview: () => ({
              geohash: 'dr5r',
              imageUrl: '/previews/region-default.png?v=20260207',
              personalized: false,
              source: 'default' as const,
              latitude: null,
              longitude: null,
            }),
            personalizeFromBrowserLocation: () => of(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('registers and navigates to landing on success', () => {
    authApiService.register.mockReturnValue(
      of({
        access_token: 'token',
        token_type: 'Bearer',
        user: {
          id: 'u-1',
          username: 'newuser',
          email: 'new@cosmic.local',
          display_name: 'newuser',
          role: 'user',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    );

    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.registerForm.setValue({
      username: 'newuser',
      email: 'new@cosmic.local',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    component.onSubmit();

    expect(authApiService.register).toHaveBeenCalledWith({
      username: 'newuser',
      email: 'new@cosmic.local',
      password: 'Password123!',
      display_name: 'newuser',
    });
    expect(authSessionService.setSession).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/landing']);
  });

  it('surfaces API conflict errors', () => {
    authApiService.register.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { message: 'Email is already in use.' },
      })),
    );

    component.registerForm.setValue({
      username: 'testuser',
      email: 'test@cosmic.local',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    component.onSubmit();

    expect(component.error).toBe('Email is already in use.');
  });
});
