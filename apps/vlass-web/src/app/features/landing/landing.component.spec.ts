import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../services/auth-session.service';
import { SkyPreviewService } from '../../services/sky-preview.service';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  let component: LandingComponent;
  let clearSessionCalls = 0;
  let authSessionService: {
    getUser: () => {
      username: string;
      email: string;
      display_name: string;
    };
    clearSession: () => void;
  };
  let skyPreviewService: {
    getInitialPreview: () => {
      geohash: string;
      imageUrl: string;
      personalized: boolean;
      source: 'cookie' | 'default' | 'browser';
      latitude: number | null;
      longitude: number | null;
    };
    personalizeFromBrowserLocation: () => Promise<{
      geohash: string;
      imageUrl: string;
      personalized: boolean;
      source: 'cookie' | 'default' | 'browser';
      latitude: number | null;
      longitude: number | null;
    } | null>;
  };
  let router: Router;

  beforeEach(async () => {
    clearSessionCalls = 0;
    authSessionService = {
      getUser: vi.fn(() => ({
        username: 'testuser',
        email: 'test@vlass.local',
        display_name: 'Test User',
      })),
      clearSession: vi.fn(() => {
        clearSessionCalls += 1;
      }),
    };
    skyPreviewService = {
      getInitialPreview: () => ({
        geohash: 'dr5r',
        imageUrl: '/previews/region-1.png',
        personalized: false,
        source: 'default',
        latitude: null,
        longitude: null,
      }),
      personalizeFromBrowserLocation: () =>
        Promise.resolve({
          geohash: 'u09t',
          imageUrl: '/previews/region-2.png',
          personalized: true,
          source: 'browser',
          latitude: 34.0522,
          longitude: -118.2437,
        }),
    };

    await TestBed.configureTestingModule({
      declarations: [LandingComponent],
      imports: [RouterTestingModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthSessionService,
          useValue: authSessionService,
        },
        {
          provide: SkyPreviewService,
          useValue: skyPreviewService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('renders MVP pillar titles', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Instant SSR First Paint');
    expect(text).toContain('Viewer, Permalinks, and Snapshots');
    expect(text).toContain('Community Research Notebook');
    expect(text).toContain('Personalize background');
  });

  it('renders deferred list from scope lock', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Deferred Beyond MVP');
    expect(text).not.toContain('Comments and replies (v1.1)');
    expect(text).not.toContain('Mode B canvas viewer (v2)');
  });

  it('clears session on logout', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.logout();

    expect(clearSessionCalls).toBe(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('personalizes preview and shows region notice', async () => {
    await component.personalizePreview();

    expect(component.preview.personalized).toBe(true);
    expect(component.preview.geohash).toBe('u09t');
    expect(component.locationMessage).toContain('U09T');
  });
});
