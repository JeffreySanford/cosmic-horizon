import { ActionReducerMap } from '@ngrx/store';
import { routerReducer } from '@ngrx/router-store';
import { AppState } from './app.state';
import { authFeatureKey, authReducer } from './features/auth/auth.reducer';
import { uiFeatureKey, uiReducer } from './features/ui/ui.reducer';
import { jobsFeatureKey, jobsReducer } from './features/jobs/jobs.reducer';
import { alertsFeatureKey, alertsReducer } from './features/alerts/alerts.reducer';
import { logsFeatureKey, logsReducer } from './features/logs/logs.reducer';
import { telemetryFeatureKey, telemetryReducer } from './features/telemetry/telemetry.reducer';
import { ephemerisFeatureKey, ephemerisReducer } from './features/ephemeris/ephemeris.reducer';

export const appReducers: ActionReducerMap<AppState> = {
  [authFeatureKey]: authReducer,
  [uiFeatureKey]: uiReducer,
  [jobsFeatureKey]: jobsReducer,
  [alertsFeatureKey]: alertsReducer,
  [logsFeatureKey]: logsReducer,
  [telemetryFeatureKey]: telemetryReducer,
  [ephemerisFeatureKey]: ephemerisReducer,
  router: routerReducer,
};
