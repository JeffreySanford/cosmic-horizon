import { createReducer, on } from '@ngrx/store';
import * as AlertsActions from './alerts.actions';

export const alertsFeatureKey = 'alerts';

export interface AlertsState {
  alerts: string[];
  loading: boolean;
  error: string | null;
}

export const initialAlertsState: AlertsState = {
  alerts: [],
  loading: false,
  error: null,
};

export const alertsReducer = createReducer(
  initialAlertsState,
  on(AlertsActions.alertsLoadRequested, (state) => ({ ...state, loading: true, error: null })),
  on(AlertsActions.alertsLoadSucceeded, (state, { alerts }) => ({
    ...state,
    alerts,
    loading: false,
    error: null,
  })),
  on(AlertsActions.alertsLoadFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
);
