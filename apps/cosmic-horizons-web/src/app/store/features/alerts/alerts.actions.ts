import { createAction, props } from '@ngrx/store';

export const alertsInitialize = createAction('[Alerts] Initialize');
export const alertsLoadRequested = createAction('[Alerts] Load Requested');
export const alertsLoadSucceeded = createAction(
  '[Alerts] Load Succeeded',
  props<{ alerts: string[] }>(),
);
export const alertsLoadFailed = createAction(
  '[Alerts] Load Failed',
  props<{ error: string }>(),
);
