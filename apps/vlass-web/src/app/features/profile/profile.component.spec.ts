import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../services/auth-session.service';
import { ProfileApiService } from './profile-api.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let profileApi: {
    getProfile: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    paramMap$ = new BehaviorSubject(convertToParamMap({}));
    router = {
      navigate: vi.fn().mockResolvedValue(true),
    };
    profileApi = {
      getProfile: vi.fn().mockReturnValue(
        of({
          user: {
            id: 'user-1',
            username: 'astro',
            display_name: 'Astro User',
            email: 'astro@vlass.local',
            created_at: '2026-02-11T00:00:00.000Z',
            bio: 'hello',
            avatar_url: null,
            role: 'user',
          },
          posts: [],
        }),
      ),
      updateProfile: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      imports: [ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() },
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: ProfileApiService,
          useValue: profileApi,
        },
        {
          provide: AuthSessionService,
          useValue: {
            getUser: vi.fn(() => ({
              id: 'user-1',
              username: 'astro',
              display_name: 'Astro User',
              email: 'astro@vlass.local',
              role: 'user',
              created_at: '2026-02-11T00:00:00.000Z',
            })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  it('redirects /profile to /profile/:username for logged-in user', () => {
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/profile', 'astro'], { replaceUrl: true });
  });

  it('loads profile for route username and patches form values', () => {
    paramMap$.next(convertToParamMap({ username: 'astro' }));
    fixture.detectChanges();

    expect(profileApi.getProfile).toHaveBeenCalledWith('astro');
    expect(component.profile?.user.username).toBe('astro');
    expect(component.editForm.value.display_name).toBe('Astro User');
    expect(component.loading).toBe(false);
  });

  it('updates profile when owner saves edits', () => {
    paramMap$.next(convertToParamMap({ username: 'astro' }));
    fixture.detectChanges();

    component.startEdit();
    component.editForm.setValue({
      display_name: 'Renamed User',
      bio: 'updated bio',
      avatar_url: 'https://example.com/avatar.png',
    });
    component.saveProfile();

    expect(profileApi.updateProfile).toHaveBeenCalledWith({
      display_name: 'Renamed User',
      bio: 'updated bio',
      avatar_url: 'https://example.com/avatar.png',
    });
    expect(component.profile?.user.display_name).toBe('Renamed User');
    expect(component.editing).toBe(false);
  });
});
