import { createAction, props } from '@ngrx/store';
import { EphemerisResult } from '../../../services/ephemeris.service';

export const ephemerisCalculateRequested = createAction(
  '[Ephemeris] Calculate Requested',
  props<{ objectName: string; epoch?: string }>(),
);
export const ephemerisCalculateSucceeded = createAction(
  '[Ephemeris] Calculate Succeeded',
  props<{ result: EphemerisResult }>(),
);
export const ephemerisCalculateFailed = createAction(
  '[Ephemeris] Calculate Failed',
  props<{ error: string }>(),
);

export const ephemerisSupportedObjectsLoadRequested = createAction('[Ephemeris] Supported Objects Load Requested');
export const ephemerisSupportedObjectsLoadSucceeded = createAction(
  '[Ephemeris] Supported Objects Load Succeeded',
  props<{ objects: string[] }>(),
);
export const ephemerisSupportedObjectsLoadFailed = createAction(
  '[Ephemeris] Supported Objects Load Failed',
  props<{ error: string }>(),
);

export const ephemerisCacheCleared = createAction('[Ephemeris] Cache Cleared');
