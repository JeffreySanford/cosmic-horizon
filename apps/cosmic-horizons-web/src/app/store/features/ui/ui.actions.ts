import { createAction, props } from '@ngrx/store';

export const mockModeHydrateRequested = createAction(
  '[UI] Mock Mode Hydrate Requested',
);
export const mockModeHydrated = createAction(
  '[UI] Mock Mode Hydrated',
  props<{ enabled: boolean }>(),
);
export const mockModeSetRequested = createAction(
  '[UI] Mock Mode Set Requested',
  props<{ enabled: boolean }>(),
);
