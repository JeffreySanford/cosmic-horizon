import { createAction, props } from '@ngrx/store';

export const telemetryInitialize = createAction('[Telemetry] Initialize');
export const telemetryLoadRequested = createAction(
  '[Telemetry] Load Requested',
);
export const telemetryLoadSucceeded = createAction(
  '[Telemetry] Load Succeeded',
  props<{ cpuMatrix: number[][]; gpuMatrix: number[][] }>(),
);
export const telemetryLoadFailed = createAction(
  '[Telemetry] Load Failed',
  props<{ error: string }>(),
);

export const telemetryWindowSelected = createAction(
  '[Telemetry] Window Selected',
  props<{ index: number }>(),
);
