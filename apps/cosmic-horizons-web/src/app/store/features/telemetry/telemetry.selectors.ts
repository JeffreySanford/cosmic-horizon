import { createFeatureSelector, createSelector } from '@ngrx/store';
import { telemetryFeatureKey, TelemetryState } from './telemetry.reducer';

export const selectTelemetryState = createFeatureSelector<TelemetryState>(telemetryFeatureKey);

export const selectTelemetryLoading = createSelector(selectTelemetryState, (state) => state.loading);
export const selectTelemetryError = createSelector(selectTelemetryState, (state) => state.error);
export const selectCpuHistory = createSelector(selectTelemetryState, (state) => state.cpuHistory);
export const selectGpuHistory = createSelector(selectTelemetryState, (state) => state.gpuHistory);
export const selectTelemetrySelectedIndex = createSelector(selectTelemetryState, (state) => state.selectedIndex);

export const selectHistoryLength = createSelector(selectCpuHistory, (history) => history.length);
export const selectGpuHistoryLength = createSelector(selectGpuHistory, (history) => history.length);

export const selectCpuHeatmap = createSelector(
  selectCpuHistory,
  selectTelemetrySelectedIndex,
  (history, index) => history[index] ?? [],
);

export const selectGpuHeatmap = createSelector(
  selectGpuHistory,
  selectTelemetrySelectedIndex,
  (history, index) => history[index] ?? [],
);

function toSeries(history: number[][][]): { name: string; series: { name: string; value: number }[] }[] {
  return history.map((matrix, idx) => {
    const flat = matrix.flat();
    const total = flat.reduce((sum, value) => sum + value, 0);
    const avg = total / Math.max(1, flat.length);

    return {
      name: `window ${idx}`,
      series: [{ name: 'avg', value: Math.round(avg) }],
    };
  });
}

export const selectProgressSeries = createSelector(selectCpuHistory, toSeries);
export const selectGpuProgressSeries = createSelector(selectGpuHistory, toSeries);
