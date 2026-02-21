import { inject, Injectable } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { mergeMap, of } from 'rxjs';
import * as AuthActions from './features/auth/auth.actions';
import * as UiActions from './features/ui/ui.actions';
import * as JobsActions from './features/jobs/jobs.actions';
import * as AlertsActions from './features/alerts/alerts.actions';
import * as TelemetryActions from './features/telemetry/telemetry.actions';

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
          JobsActions.jobsInitialize(),
          AlertsActions.alertsInitialize(),
          TelemetryActions.telemetryInitialize(),
        ),
      ),
    ),
  );

}
