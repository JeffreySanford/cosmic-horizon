import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, interval, map, of, startWith, switchMap } from 'rxjs';
import * as AlertsActions from './alerts.actions';

@Injectable()
export class AlertsEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);

  initialize$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AlertsActions.alertsInitialize),
      switchMap(() =>
        interval(2000).pipe(
          startWith(0),
          map(() => AlertsActions.alertsLoadRequested()),
        ),
      ),
    ),
  );

  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AlertsActions.alertsLoadRequested),
      switchMap(() =>
        this.http.get<string[]>('/api/health/alerts').pipe(
          map((alerts) => AlertsActions.alertsLoadSucceeded({ alerts })),
          catchError(() =>
            of(AlertsActions.alertsLoadSucceeded({ alerts: [] })),
          ),
        ),
      ),
    ),
  );
}
