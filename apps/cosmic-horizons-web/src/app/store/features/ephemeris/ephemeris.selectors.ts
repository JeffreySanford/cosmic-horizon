import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ephemerisFeatureKey, EphemerisState } from './ephemeris.reducer';

export const selectEphemerisState = createFeatureSelector<EphemerisState>(ephemerisFeatureKey);
export const selectEphemerisCalculating = createSelector(selectEphemerisState, (state) => state.calculating);
export const selectEphemerisLastResult = createSelector(selectEphemerisState, (state) => state.lastResult);
export const selectEphemerisSupportedObjects = createSelector(selectEphemerisState, (state) => state.supportedObjects);
export const selectEphemerisError = createSelector(selectEphemerisState, (state) => state.error);
