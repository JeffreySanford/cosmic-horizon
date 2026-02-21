import { TestBed } from '@angular/core/testing';
import { PerformanceDataService } from './performance-data.service';
import { firstValueFrom } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { selectCpuHeatmap, selectGpuHeatmap, selectGpuHistoryLength, selectGpuProgressSeries, selectHistoryLength, selectProgressSeries } from '../store/features/telemetry/telemetry.selectors';
import * as TelemetryActions from '../store/features/telemetry/telemetry.actions';
import { vi } from 'vitest';

describe('PerformanceDataService', () => {
  let service: PerformanceDataService;
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PerformanceDataService,
        provideMockStore(),
      ],
    });
    store = TestBed.inject(MockStore);
    store.overrideSelector(selectHistoryLength, 3);
    store.overrideSelector(selectGpuHistoryLength, 2);
    store.overrideSelector(selectCpuHeatmap, [[42]]);
    store.overrideSelector(selectGpuHeatmap, [[7]]);
    store.overrideSelector(selectProgressSeries, [
      { name: 'window 0', series: [{ name: 'avg', value: 42 }] },
    ]);
    store.overrideSelector(selectGpuProgressSeries, [
      { name: 'window 0', series: [{ name: 'avg', value: 7 }] },
    ]);
    store.refreshState();
    service = TestBed.inject(PerformanceDataService);
  });

  it('reads telemetry data from selectors', async () => {
    const len = await firstValueFrom(service.historyLength$);
    expect(len).toBe(3);

    const matrix = await firstValueFrom(service.cpuHeatmap$);
    expect(matrix).toEqual([[42]]);

    const gmatrix = await firstValueFrom(service.gpuHeatmap$);
    expect(gmatrix).toEqual([[7]]);

    const prog = await firstValueFrom(service.progressSeries$);
    expect(prog[0]?.name).toBe('window 0');
    const gprog = await firstValueFrom(service.gpuProgressSeries$);
    expect(gprog[0]?.series[0]?.value).toBe(7);
  });

  it('dispatches window selection through store', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    service.setWindow(4);
    expect(dispatchSpy).toHaveBeenCalledWith(
      TelemetryActions.telemetryWindowSelected({ index: 4 }),
    );
  });
});
