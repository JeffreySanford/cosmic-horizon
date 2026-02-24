import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViewerSsrTelemetryService } from './viewer-ssr-telemetry.service';
import { TestBed } from '@angular/core/testing';
import { ViewerComponent } from './viewer.component';
import { provideMockStore } from '@ngrx/store/testing';
import { ActivatedRoute } from '@angular/router';

describe('Viewer SSR', () => {
  let telemetry: ViewerSsrTelemetryService;

  beforeEach(() => {
    const initialStoreState = {
      auth: {
        accessToken: null,
        refreshToken: null,
        user: null,
        role: 'guest',
        hydrated: true,
        loading: false,
        error: null,
      },
      ui: { mockModeEnabled: true },
      jobs: { ids: [], entities: {}, selectedJobId: null, loading: false, error: null },
      alerts: { alerts: [], loading: false, error: null },
      logs: { entries: [] },
      telemetry: { cpuHistory: [], gpuHistory: [], selectedIndex: 0, loading: false, error: null },
      ephemeris: { calculating: false, lastResult: null, supportedObjects: [], error: null },
      router: null,
    } as const;

    TestBed.configureTestingModule({
      providers: [
        ViewerComponent,
        ViewerSsrTelemetryService,
        provideMockStore({ initialState: initialStoreState }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: { get: () => null },
            queryParamMap: { get: () => null },
            snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } },
          },
        },
      ],
    });

    telemetry = TestBed.inject(ViewerSsrTelemetryService);
  });

  it('records a near-zero bootstrap duration when hydrating from SSR', () => {
    const comp = TestBed.inject(ViewerComponent);
    const spy = vi.spyOn(telemetry, 'recordBootstrapDuration');

    // simulate hydrated bootstrap data
    (comp as any).bootstrapData = { state: { ra: 1, dec: 2, fov: 1.5, survey: 'VLASS', labels: [] } };

    // call hydrateStateFromRoute which should record a zero-duration bootstrap
    (comp as any).hydrateStateFromRoute();

    expect(spy).toHaveBeenCalled();
    const ms = spy.mock.calls[0][0] as number;
    expect(ms).toBeLessThanOrEqual(1);
  });
});
