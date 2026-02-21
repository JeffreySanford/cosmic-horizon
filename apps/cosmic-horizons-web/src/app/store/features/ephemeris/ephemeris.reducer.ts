import { createReducer, on } from '@ngrx/store';
import { EphemerisResult } from '../../../services/ephemeris.service';
import * as EphemerisActions from './ephemeris.actions';

export const ephemerisFeatureKey = 'ephemeris';

export interface EphemerisState {
  calculating: boolean;
  lastResult: EphemerisResult | null;
  supportedObjects: string[];
  error: string | null;
}

export const initialEphemerisState: EphemerisState = {
  calculating: false,
  lastResult: null,
  supportedObjects: [],
  error: null,
};

export const ephemerisReducer = createReducer(
  initialEphemerisState,
  on(EphemerisActions.ephemerisCalculateRequested, EphemerisActions.ephemerisSupportedObjectsLoadRequested, (state) => ({
    ...state,
    calculating: true,
    error: null,
  })),
  on(EphemerisActions.ephemerisCalculateSucceeded, (state, { result }) => ({
    ...state,
    calculating: false,
    lastResult: result,
    error: null,
  })),
  on(EphemerisActions.ephemerisCalculateFailed, EphemerisActions.ephemerisSupportedObjectsLoadFailed, (state, { error }) => ({
    ...state,
    calculating: false,
    error,
  })),
  on(EphemerisActions.ephemerisSupportedObjectsLoadSucceeded, (state, { objects }) => ({
    ...state,
    calculating: false,
    supportedObjects: objects,
    error: null,
  })),
  on(EphemerisActions.ephemerisCacheCleared, (state) => ({
    ...state,
    lastResult: null,
  })),
);
