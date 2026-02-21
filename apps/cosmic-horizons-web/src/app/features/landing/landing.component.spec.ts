import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of } from 'rxjs';
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
      role: 'user' | 'admin' | 'moderator';
    };
    clearSession: () => void;
    getRefreshToken: () => string | null;
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
    personalizeFromCoordinates: (
      latitude: number,
      longitude: number,
    ) => Observable<{
      geohash: string;
      imageUrl: string;
      personalized: boolean;
      source: 'cookie' | 'default' | 'browser';
      latitude: number | null;
      longitude: number | null;
    } | null>;
    personalizeFromBrowserLocation: () => Observable<{
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
        email: 'test@cosmic.local',
        display_name: 'Test User',
        role: 'admin' as const,
      })),
      clearSession: vi.fn(() => {
        clearSessionCalls += 1;
      }),
      getRefreshToken: vi.fn(() => 'refresh-token'),
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
      personalizeFromCoordinates: (latitude: number, longitude: number) =>
        of({
          geohash: 'u09t',
          imageUrl: '/previews/region-2.png',
          personalized: true,
          source: 'browser',
          latitude,
          longitude,
        }),
      personalizeFromBrowserLocation: () =>
        of({
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
    expect(text).toContain('Viewer, Permalinks, and Snapshots');
    expect(text).toContain('Scientific Ephemeris & Target Search');
    expect(text).toContain('Community Research Notebook');
    expect(text).toContain('Mission Routes');
    expect(text).toContain('Job Console');
    expect(text).toContain('System Logs');
    expect(text).toContain('Operations');
    expect(text).not.toContain('Job Dashboard');
    expect(text).not.toContain('Node Performance');
    expect(text).not.toContain('CPU Heatmap');
    expect(text).not.toContain('Progress Graph');
    expect(text).not.toContain('Load Tests');
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

  it('navigates to logs for admin users', () => {
    const navigateSpy = vi
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    component.openLogs();

    expect(component.isAdmin).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('/logs');
  });

  it('hides admin-only route links for non-admin users', () => {
    component.user.role = 'user';

    const routeTitles = component.visibleRouteLinks.map((link) => link.title);
    expect(routeTitles).toContain('Job Console');
    expect(routeTitles).not.toContain('System Logs');
  });

  it('navigates when opening a mission route card', () => {
    const navigateSpy = vi
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    component.openRouteLink({
      icon: 'workspaces',
      title: 'Job Console',
      route: '/jobs',
      summary: 'Inspect active jobs, status transitions, and queue behavior.',
    });

    expect(navigateSpy).toHaveBeenCalledWith('/jobs');
  });

  it('first telemetry control personalizes preview and expands telemetry', async () => {
    component.onTelemetryControl();
    await Promise.resolve();

    expect(component.preview.personalized).toBe(true);
    expect(component.preview.geohash).toBe('u09t');
    expect(component.latLonLabel).toContain('LAT 34.0522');
    expect(component.telemetryCompact).toBe(false);
    expect(component.locationMessage).toBe(
      'Sky map personalized to your overhead location.',
    );
  });

  it('after first prompt, telemetry control toggles compact mode', async () => {
    component.onTelemetryControl();
    await Promise.resolve();
    expect(component.telemetryCompact).toBe(false);

    component.onTelemetryControl();
    expect(component.telemetryCompact).toBe(true);
  });

  it('when browser personalization fails, telemetry still expands', async () => {
    vi.spyOn(
      skyPreviewService,
      'personalizeFromBrowserLocation',
    ).mockReturnValueOnce(of(null));

    component.onTelemetryControl();
    await Promise.resolve();

    expect(component.preview.personalized).toBe(false);
    expect(component.latLonLabel).toBe('LAT --.---- | LON --.----');
    expect(component.telemetryCompact).toBe(false);
    expect(component.locationMessage).toBe(
      'Failed to personalize preview. Using default.',
    );
  });

  it('sets error message when browser personalization errors', async () => {
    vi.spyOn(
      skyPreviewService,
      'personalizeFromBrowserLocation',
    ).mockImplementationOnce(
      () =>
        new Observable((observer) => {
          observer.error(new Error('geo error'));
        }),
    );

    component.onTelemetryControl();
    await Promise.resolve();

    expect(component.locationMessage).toBe(
      'Error personalizing preview. Using default.',
    );
  });
});
