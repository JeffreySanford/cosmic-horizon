import { createReducer, on } from '@ngrx/store';
import * as TelemetryActions from './telemetry.actions';

export const telemetryFeatureKey = 'telemetry';

export interface TelemetryState {
  cpuHistory: number[][][];
  gpuHistory: number[][][];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
}

export const initialTelemetryState: TelemetryState = {
  cpuHistory: [],
  gpuHistory: [],
  selectedIndex: 0,
  loading: false,
  error: null,
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  if (index < 0) {
    return 0;
  }
  if (index >= length) {
    return length - 1;
  }
  return index;
}

export const telemetryReducer = createReducer(
  initialTelemetryState,
  on(TelemetryActions.telemetryLoadRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(
    TelemetryActions.telemetryLoadSucceeded,
    (state, { cpuMatrix, gpuMatrix }) => {
      const cpuHistory = [...state.cpuHistory, cpuMatrix].slice(-20);
      const gpuHistory = [...state.gpuHistory, gpuMatrix].slice(-20);

      return {
        ...state,
        cpuHistory,
        gpuHistory,
        selectedIndex: clampIndex(state.selectedIndex, cpuHistory.length),
        loading: false,
        error: null,
      };
    },
  ),
  on(TelemetryActions.telemetryLoadFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(TelemetryActions.telemetryWindowSelected, (state, { index }) => ({
    ...state,
    selectedIndex: clampIndex(index, state.cpuHistory.length),
  })),
);
