import { inject, Injectable } from '@angular/core';
import {
  Actions,
  ROOT_EFFECTS_INIT,
  createEffect,
  ofType,
} from '@ngrx/effects';
import { mergeMap, of } from 'rxjs';
import * as AuthActions from './features/auth/auth.actions';
import * as UiActions from './features/ui/ui.actions';
import * as AlertsActions from './features/alerts/alerts.actions';
// TelemetryActions no longer used in this file; removed to keep lint happy

@Injectable()
export class AppEffects {
  private readonly actions$ = inject(Actions);

  init$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      mergeMap(() =>
        of(
          AuthActions.authHydrateRequested(),
          UiActions.mockModeHydrateRequested(),
          // jobsInitialize is now triggered lazily by the job console itself
          AlertsActions.alertsInitialize(),
          // telemetryInitialize is now dispatched lazily by
          // PerformanceDataService (and only in views that care about it)
        ),
      ),
    ),
  );
}
