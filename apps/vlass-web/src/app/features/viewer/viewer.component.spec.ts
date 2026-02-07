import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerApiService } from './viewer-api.service';
import { ViewerComponent } from './viewer.component';

interface MockAladinView {
  gotoRaDec: ReturnType<typeof vi.fn>;
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
    };

    await TestBed.configureTestingModule({
      declarations: [ViewerComponent],
      imports: [ReactiveFormsModule, RouterTestingModule, NoopAnimationsModule],
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

    expect(mockAladinView.setImageSurvey).toHaveBeenCalledWith('P/DSS2/color');
  });

  it('syncs form values when Aladin emits position and zoom events', async () => {
    mockAladinView.getRaDec.mockReturnValue([199.1234, -12.3456]);
    mockAladinView.getFov.mockReturnValue(2.25);

    eventCallbacks['positionChanged']?.();
    eventCallbacks['zoomChanged']?.();
    await fixture.whenStable();

    expect(component.stateForm.value.ra).toBe(199.1234);
    expect(component.stateForm.value.dec).toBe(-12.3456);
    expect(component.stateForm.value.fov).toBe(2.25);
  });
});
