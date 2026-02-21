import { RouterReducerState } from '@ngrx/router-store';
import { AuthState } from './features/auth/auth.reducer';
import { UiState } from './features/ui/ui.reducer';
import { JobsState } from './features/jobs/jobs.reducer';
import { AlertsState } from './features/alerts/alerts.reducer';
import { LogsState } from './features/logs/logs.reducer';
import { TelemetryState } from './features/telemetry/telemetry.reducer';
import { EphemerisState } from './features/ephemeris/ephemeris.reducer';

export interface AppState {
  auth: AuthState;
  ui: UiState;
  jobs: JobsState;
  alerts: AlertsState;
  logs: LogsState;
  telemetry: TelemetryState;
  ephemeris: EphemerisState;
  router: RouterReducerState;
}
