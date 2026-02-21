import { createFeatureSelector, createSelector } from '@ngrx/store';
import { alertsFeatureKey, AlertsState } from './alerts.reducer';

export const selectAlertsState =
  createFeatureSelector<AlertsState>(alertsFeatureKey);
export const selectAlerts = createSelector(
  selectAlertsState,
  (state) => state.alerts,
);
export const selectAlertsLoading = createSelector(
  selectAlertsState,
  (state) => state.loading,
);
export const selectAlertsError = createSelector(
  selectAlertsState,
  (state) => state.error,
);
