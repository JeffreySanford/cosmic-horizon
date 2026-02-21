import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import * as TelemetryActions from '../store/features/telemetry/telemetry.actions';
import {
  selectCpuHeatmap,
  selectGpuHeatmap,
  selectGpuHistoryLength,
  selectGpuProgressSeries,
  selectHistoryLength,
  selectProgressSeries,
} from '../store/features/telemetry/telemetry.selectors';
import { AppState } from '../store/app.state';

@Injectable({ providedIn: 'root' })
export class PerformanceDataService {
  private readonly store = inject<Store<AppState>>(Store);

  constructor() {
    this.store.dispatch(TelemetryActions.telemetryInitialize());
  }

  /** expose number of available windows */
  get historyLength$(): Observable<number> {
    return this.store.select(selectHistoryLength);
  }

  /** choose which window to display */
  setWindow(index: number) {
    this.store.dispatch(TelemetryActions.telemetryWindowSelected({ index }));
  }

  /** heatmap slice corresponding to selected window */
  get cpuHeatmap$(): Observable<number[][]> {
    return this.store.select(selectCpuHeatmap);
  }

  /** optional GPU stream if needed */
  get gpuHeatmap$(): Observable<number[][]> {
    return this.store.select(selectGpuHeatmap);
  }

  /** expose number of GPU windows available */
  get gpuHistoryLength$(): Observable<number> {
    return this.store.select(selectGpuHistoryLength);
  }

  /** derived progress series: average CPU value per window */
  get progressSeries$(): Observable<{ name: string; series: { name: string; value: number }[] }[]> {
    return this.store.select(selectProgressSeries);
  }

  /** derived GPU average per window (same shape as progressSeries$) */
  get gpuProgressSeries$(): Observable<{ name: string; series: { name: string; value: number }[] }[]> {
    return this.store.select(selectGpuProgressSeries);
  }
}
