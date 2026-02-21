import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  catchError,
  forkJoin,
  interval,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import * as TelemetryActions from './telemetry.actions';
import * as JobsActions from '../jobs/jobs.actions';

@Injectable()
export class TelemetryEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);

  initialize$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TelemetryActions.telemetryInitialize),
      switchMap(() =>
        interval(1000).pipe(
          startWith(0),
          map(() => TelemetryActions.telemetryLoadRequested()),
        ),
      ),
    ),
  );

  refreshOnJobUpdate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobUpdateReceived),
      map(() => TelemetryActions.telemetryLoadRequested()),
    ),
  );

  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TelemetryActions.telemetryLoadRequested),
      switchMap(() =>
        forkJoin({
          cpuMatrix: this.http
            .get<number[][]>('/api/metrics/heatmap')
            .pipe(catchError(() => of(this.generateMatrix(10, 10)))),
          gpuMatrix: this.http
            .get<number[][]>('/api/metrics/gpu-heatmap')
            .pipe(catchError(() => of(this.generateMatrix(10, 10)))),
        }).pipe(
          map(({ cpuMatrix, gpuMatrix }) =>
            TelemetryActions.telemetryLoadSucceeded({ cpuMatrix, gpuMatrix }),
          ),
          catchError(() =>
            of(
              TelemetryActions.telemetryLoadFailed({
                error: 'Unable to load telemetry',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  private generateMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.random() * 100),
    );
  }
}
