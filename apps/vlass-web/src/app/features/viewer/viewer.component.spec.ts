import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ViewerApiService, ViewerStateModel } from './viewer-api.service';
import { ViewerComponent } from './viewer.component';
import { AuthSessionService } from '../../services/auth-session.service';

interface MockAladinView {
  gotoRaDec: ReturnType<typeof vi.fn>;
  gotoObject?: ReturnType<typeof vi.fn>;
  setFoV: ReturnType<typeof vi.fn>;
  setImageSurvey: ReturnType<typeof vi.fn>;
  getFov: ReturnType<typeof vi.fn>;
  getRaDec: ReturnType<typeof vi.fn>;
  getViewDataURL: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

describe('ViewerComponent', () => {
  let fixture: ComponentFixture<ViewerComponent>;
  let component: ViewerComponent;
  let mockAladinView: MockAladinView;
  let eventCallbacks: Record<string, () => void>;
  let viewerApiService: {
    createState: ReturnType<typeof vi.fn>;
    resolveState: ReturnType<typeof vi.fn>;
    createSnapshot: ReturnType<typeof vi.fn>;
    resolveEphemeris: ReturnType<typeof vi.fn>;
    getNearbyLabels: ReturnType<typeof vi.fn>;
    getCutoutTelemetry: ReturnType<typeof vi.fn>;
    scienceDataUrl: ReturnType<typeof vi.fn>;
  };
  let authSessionService: {
    getRole: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    eventCallbacks = {};
    mockAladinView = {
      gotoRaDec: vi.fn(),
      setFoV: vi.fn(),
      setImageSurvey: vi.fn(),
      getFov: vi.fn().mockReturnValue(1.5),
      getRaDec: vi.fn().mockReturnValue([187.25, 2.05]),
      getViewDataURL: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
      on: vi.fn((event: string, callback: () => void) => {
        eventCallbacks[event] = callback;
      }),
    };

    const aladinFactory = {
      init: Promise.resolve(),
      aladin: vi.fn().mockReturnValue(mockAladinView),
    };
    (window as unknown as { A: typeof aladinFactory }).A = aladinFactory;

    viewerApiService = {
      createState: vi.fn(),
      resolveState: vi.fn(),
      createSnapshot: vi.fn(),
      resolveEphemeris: vi.fn().mockReturnValue(of(null)),
      getNearbyLabels: vi.fn().mockReturnValue(of([])),
      getCutoutTelemetry: vi.fn().mockReturnValue(
        of({
          requests_total: 2,
          success_total: 1,
          failure_total: 1,
          provider_attempts_total: 3,
          provider_failures_total: 2,
          cache_hits_total: 0,
          resolution_fallback_total: 1,
          survey_fallback_total: 0,
          consecutive_failures: 1,
          last_success_at: '2026-02-07T00:00:00.000Z',
          last_failure_at: '2026-02-07T00:00:10.000Z',
          last_failure_reason: 'status 503',
          recent_failures: [],
        }),
      ),
      scienceDataUrl: vi.fn().mockReturnValue('http://localhost:3000/api/view/cutout?ra=1'),
    };
    authSessionService = {
      getRole: vi.fn().mockReturnValue('admin'),
    };

    await TestBed.configureTestingModule({
      declarations: [ViewerComponent],
      imports: [FormsModule, ReactiveFormsModule, RouterTestingModule, NoopAnimationsModule, HttpClientTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ViewerApiService,
          useValue: viewerApiService,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: of(convertToParamMap({})),
            snapshot: {
              paramMap: convertToParamMap({}),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: AuthSessionService,
          useValue: authSessionService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();
  });

  afterEach(() => {
    delete (window as unknown as { A?: unknown }).A;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with encoded default state', () => {
    expect(component.encodedState.length).toBeGreaterThan(0);
  });

  it('creates permalink and sets short id', () => {
    viewerApiService.createState.mockReturnValue(
      of({
        id: 'state-1',
        short_id: 'short123',
        encoded_state: 'abc',
        state: { ra: 187.25, dec: 2.05, fov: 1.5, survey: 'VLASS' },
        permalink_path: '/view/short123',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    );

    component.createPermalink();

    expect(viewerApiService.createState).toHaveBeenCalled();
    expect(component.shortId).toBe('short123');
    expect(router.navigate).toHaveBeenCalled();
  });

  it('surfaces API errors while creating permalink', () => {
    viewerApiService.createState.mockReturnValue(
      throwError(() => ({ error: { message: 'invalid state' }, status: 400 })),
    );

    component.createPermalink();

    expect(component.statusMessage).toContain('invalid state');
  });

  it('creates a snapshot using Aladin image data', async () => {
    viewerApiService.createSnapshot.mockReturnValue(
      of({
        id: 'snapshot-1',
        image_url: '/api/view/snapshots/snapshot-1.png',
        short_id: null,
        size_bytes: 1024,
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    );

    (component as unknown as { downloadSnapshot: () => void }).downloadSnapshot = vi.fn();
    component.saveSnapshot();
    await fixture.whenStable();

    expect(mockAladinView.getViewDataURL).toHaveBeenCalled();
    expect(viewerApiService.createSnapshot).toHaveBeenCalled();
  });

  it('applies survey changes to the Aladin image layer', async () => {
    component.stateForm.patchValue({ survey: 'DSS2' });
    await fixture.whenStable();

    expect(mockAladinView.setImageSurvey).toHaveBeenCalledWith('https://skies.esac.esa.int/DSSColor');
  });

  it('switches VLASS to higher-resolution survey when deeply zoomed', async () => {
    component.stateForm.patchValue({ survey: 'VLASS', fov: 0.3 });
    await fixture.whenStable();

    expect(mockAladinView.setImageSurvey).toHaveBeenCalledWith('P/PanSTARRS/DR1/color-z-zg-g');
  });

  it('syncs form values when Aladin emits position and zoom events', async () => {
    vi.useFakeTimers();
    mockAladinView.getRaDec.mockReturnValue([199.1234, -12.3456]);
    mockAladinView.getFov.mockReturnValue(2.25);

    eventCallbacks['positionChanged']?.();
    eventCallbacks['zoomChanged']?.();
    await vi.advanceTimersByTimeAsync(1000);
    await fixture.whenStable();

    expect(component.stateForm.value.ra).toBe(199.1234);
    expect(component.stateForm.value.dec).toBe(-12.3456);
    expect(component.stateForm.value.fov).toBe(2.25);
  });

  it('adds a center label to viewer state', () => {
    component.labelDraft = 'M87 Core';
    component.addCenterLabel();

    expect(component.labels[0]?.name).toBe('M87 Core');
    expect(component.labels[0]?.ra).toBeTypeOf('number');
  });

  it('keeps catalog labels separate and can convert them to manual annotations', () => {
    component.catalogLabels = [
      {
        name: 'Alpha Centauri B',
        ra: 219.9021,
        dec: -60.8353,
        object_type: 'Star',
        angular_distance_deg: 0.011,
        confidence: 0.91,
      },
    ];

    component.addCatalogLabelAsAnnotation(component.catalogLabels[0]);

    expect(component.labels[0]?.name).toBe('Alpha Centauri B');
    expect(component.catalogLabels.length).toBe(1);
  });

  it('exposes nearest center catalog label and annotates it', () => {
    component.stateForm.patchValue({ fov: 0.5 });
    component.catalogLabels = [
      {
        name: 'Far Source',
        ra: 219.9,
        dec: -60.83,
        object_type: 'Galaxy',
        angular_distance_deg: 0.08,
        confidence: 0.8,
      },
      {
        name: 'Center Match',
        ra: 219.91,
        dec: -60.84,
        object_type: 'Star',
        angular_distance_deg: 0.01,
        confidence: 0.92,
      },
    ];

    expect(component.centerCatalogLabel?.name).toBe('Center Match');
    component.addCenterCatalogLabelAsAnnotation();
    expect(component.labels[0]?.name).toBe('Center Match');
  });

  it('searchTarget uses Aladin gotoObject when available', async () => {
    const viewerWithAladin = component as unknown as { aladinView: MockAladinView | null };
    const originalAladin = viewerWithAladin.aladinView;
    viewerWithAladin.aladinView = {
      gotoObject: vi.fn().mockResolvedValue(void 0),
      getRaDec: vi.fn().mockReturnValue([42.1234, -12.5678]),
      gotoRaDec: vi.fn(),
      setFoV: vi.fn(),
      setImageSurvey: vi.fn(),
      getFov: vi.fn().mockReturnValue(1.5),
      getViewDataURL: vi.fn(),
      on: vi.fn(),
    };
    component.targetQuery = 'M31';

    await component.searchTarget();

    const view = viewerWithAladin.aladinView as MockAladinView;
    expect(view.gotoObject).toHaveBeenCalledWith('M31');
    expect(component.stateForm.value.ra).toBeCloseTo(42.1234, 3);
    expect(component.stateForm.value.dec).toBeCloseTo(-12.5678, 3);
    viewerWithAladin.aladinView = originalAladin;
  });

  it('searchTarget falls back to SkyBot when Aladin resolver fails', async () => {
    const viewerWithAladin = component as unknown as { aladinView: MockAladinView | null };
    const originalAladin = viewerWithAladin.aladinView;
    viewerWithAladin.aladinView = {
      gotoObject: vi.fn().mockRejectedValue(new Error('fail')),
      getRaDec: vi.fn().mockReturnValue([0, 0]),
      gotoRaDec: vi.fn(),
      setFoV: vi.fn(),
      setImageSurvey: vi.fn(),
      getFov: vi.fn().mockReturnValue(1.5),
      getViewDataURL: vi.fn(),
      on: vi.fn(),
    };
    const resolveSpy = vi
      .spyOn(
        component as unknown as {
          resolveWithSkybot$: (name: string) => import('rxjs').Observable<{ ra: number; dec: number } | null>;
        },
        'resolveWithSkybot$',
      )
      .mockReturnValue(of({ ra: 100.1234, dec: -5.6789 }));
    viewerApiService.resolveEphemeris.mockReturnValue(
      throwError(() => new Error('ephemeris unavailable')),
    );
    component.targetQuery = 'Venus';

    await component.searchTarget();

    expect(resolveSpy).toHaveBeenCalledWith('Venus');
    expect(component.stateForm.value.ra).toBeCloseTo(100.1234, 3);
    expect(component.stateForm.value.dec).toBeCloseTo(-5.6789, 3);
    viewerWithAladin.aladinView = originalAladin;
  });

  it('hides center label when overlay is toggled off and restores it after lookup when toggled on', async () => {
    vi.useFakeTimers();
    component.stateForm.patchValue({ ra: 219.91, dec: -60.84, fov: 0.5 });
    (component as unknown as { hasUserZoomedIn: boolean }).hasUserZoomedIn = true;
    viewerApiService.getNearbyLabels.mockReturnValue(
      of([
        {
          name: 'Center Match',
          ra: 219.91,
          dec: -60.84,
          object_type: 'Star',
          angular_distance_deg: 0.01,
          confidence: 0.92,
        },
      ]),
    );

    component.catalogLabels = [
      {
        name: 'Center Match',
        ra: 219.91,
        dec: -60.84,
        object_type: 'Star',
        angular_distance_deg: 0.01,
        confidence: 0.92,
      },
    ];
    expect(component.centerCatalogLabel?.name).toBe('Center Match');

    component.toggleLabelsOverlay(false);
    expect(component.centerCatalogLabel).toBeNull();
    expect(component.catalogLabels).toEqual([]);

    component.toggleLabelsOverlay(true);
    await vi.advanceTimersByTimeAsync(1000);
    await fixture.whenStable();

    expect(viewerApiService.getNearbyLabels).toHaveBeenCalled();
    expect(component.centerCatalogLabel?.name).toBe('Center Match');
  });

  it('clears stale catalog labels immediately when center moves', () => {
    component.catalogLabels = [
      {
        name: 'Old Match',
        ra: 187.25,
        dec: 2.05,
        object_type: 'Galaxy',
        angular_distance_deg: 0.005,
        confidence: 0.8,
      },
    ];

    (component as unknown as { scheduleNearbyLabelLookup: (state: ViewerStateModel) => void }).scheduleNearbyLabelLookup({
      ra: 188.25,
      dec: 3.05,
      fov: 1.5,
      survey: 'VLASS',
      labels: [],
    });

    expect(component.catalogLabels).toEqual([]);
  });

  it('opens backend cutout path for science data download', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    component.labels = [
      {
        name: 'M87 Core',
        ra: 187.25,
        dec: 2.05,
        created_at: '2026-02-07T00:00:00.000Z',
      },
    ];

    component.downloadScienceData();

    expect(viewerApiService.scienceDataUrl).toHaveBeenCalledWith(expect.any(Object), 'M87 Core', 'max');
    expect(openSpy).toHaveBeenCalled();
  });

  it('shows deep-zoom native resolution hint at tiny FoV', () => {
    component.stateForm.patchValue({ survey: 'VLASS', fov: 0.009 });

    expect(component.nativeResolutionHint).toContain('Near native resolution');
  });

  it('shows auto-switch hint when VLASS uses sharper fallback survey', () => {
    component.stateForm.patchValue({ survey: 'VLASS', fov: 0.3 });

    expect(component.nativeResolutionHint).toContain('Auto-switched');
  });

  it('loads cutout telemetry and computes success rate', () => {
    expect(viewerApiService.getCutoutTelemetry).toHaveBeenCalled();
    expect(component.cutoutTelemetry?.requests_total).toBe(2);
    expect(component.cutoutSuccessRate).toBe('50.0%');
  });

  it('offers a one-click sharper survey suggestion', () => {
    component.stateForm.patchValue({ survey: 'VLASS', fov: 0.3 });

    expect(component.suggestedSharperSurvey).toBe('P/PanSTARRS/DR1/color-z-zg-g');
    component.applySuggestedSurvey();
    expect(component.stateForm.value.survey).toBe('P/PanSTARRS/DR1/color-z-zg-g');
  });
});
