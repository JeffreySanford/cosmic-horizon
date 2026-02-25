import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  catchError,
  interval,
  map,
  mergeMap,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { Job, JobSubmissionResponse } from '../../../features/jobs/jobs.models';
import { MessagingService } from '../../../services/messaging.service';
import * as JobsActions from './jobs.actions';

@Injectable()
export class JobsEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  private readonly messaging = inject(MessagingService);
  private jobsPollingBlockedByAuth = false;

  initialize$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobsInitialize),
      tap(() => {
        this.jobsPollingBlockedByAuth = false;
      }),
      map(() => JobsActions.jobsLoadRequested()),
    ),
  );

  pollJobs$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobsInitialize),
      switchMap(() =>
        interval(5000).pipe(
          startWith(0),
          map(() => JobsActions.jobsLoadRequested()),
        ),
      ),
    ),
  );

  loadJobs$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobsLoadRequested),
      switchMap(() => {
        if (this.jobsPollingBlockedByAuth) {
          return of(
            JobsActions.jobsLoadFailed({
              error: 'Authentication required to load job history',
            }),
          );
        }

        return this.http
          .get<{ jobs: Job[]; total: number }>('/api/jobs/history/list')
          .pipe(
            map((response) =>
              JobsActions.jobsLoadSucceeded({ jobs: response.jobs }),
            ),
            catchError((error: HttpErrorResponse) => {
              const details = this.describeHttpError(error);
              console.error('[JobsEffects] jobsLoadRequested failed', details);

              if (error.status === 401) {
                this.jobsPollingBlockedByAuth = true;
              }

              return of(
                JobsActions.jobsLoadFailed({
                  error:
                    error.status === 401
                      ? 'Authentication required to load job history'
                      : `Unable to load jobs (${details.summary})`,
                }),
              );
            }),
          );
      }),
    ),
  );

  cancelJob$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobCancelledRequested),
      switchMap(({ jobId }) =>
        this.http.delete<void>(`/api/jobs/${jobId}`).pipe(
          mergeMap(() =>
            of(
              JobsActions.jobCancelledSucceeded({ jobId }),
              JobsActions.jobsLoadRequested(),
            ),
          ),
          catchError((error: HttpErrorResponse) => {
            const details = this.describeHttpError(error);
            console.error(
              '[JobsEffects] jobCancelledRequested failed',
              details,
            );
            return of(
              JobsActions.jobCancelledFailed({
                error: `Unable to cancel job (${details.summary})`,
              }),
            );
          }),
        ),
      ),
    ),
  );

  submitJob$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobSubmittedRequested),
      switchMap(({ request }) =>
        this.http.post<JobSubmissionResponse>('/api/jobs/submit', request).pipe(
          mergeMap((response) =>
            of(
              JobsActions.jobSubmittedSucceeded({ response }),
              JobsActions.jobsLoadRequested(),
            ),
          ),
          catchError((error: HttpErrorResponse) => {
            const details = this.describeHttpError(error);
            console.error(
              '[JobsEffects] jobSubmittedRequested failed',
              details,
            );
            return of(
              JobsActions.jobSubmittedFailed({
                error: `Unable to submit job (${details.summary})`,
              }),
            );
          }),
        ),
      ),
    ),
  );

  bridgeJobUpdates$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobsInitialize),
      tap(() => this.messaging.ensureConnected()),
      switchMap(() =>
        this.messaging.jobUpdate$.pipe(
          map((update) =>
            JobsActions.jobUpdateReceived({
              update: update as Partial<Job> & { id: string },
            }),
          ),
        ),
      ),
    ),
  );

  private describeHttpError(error: HttpErrorResponse): {
    status: number;
    statusText: string;
    url: string;
    message: string;
    correlationId: string | null;
    summary: string;
    reason: string;
  } {
    const headers =
      error.headers instanceof HttpHeaders ? error.headers : undefined;
    const correlationId = headers?.get('x-correlation-id') ?? null;
    const backendMessage =
      typeof error.error === 'string'
        ? error.error
        : ((error.error?.message as string | undefined) ?? error.message);
    const status = error.status ?? 0;
    const statusText = error.statusText || 'Unknown Error';
    const url = error.url ?? 'unknown-url';
    const summary = `${status} ${statusText}`;
    let reason = 'request_failed';
    if (status === 401) {
      reason = 'auth_required';
    } else if (status === 403) {
      reason = 'forbidden';
    } else if (status === 404) {
      reason = 'not_found';
    } else if (status === 0) {
      reason = 'network_unreachable';
    } else if (status >= 500) {
      const messageLower = backendMessage.toLowerCase();
      reason =
        messageLower.includes('econnrefused') ||
        messageLower.includes('connect')
          ? 'backend_unavailable'
          : 'server_error';
    }

    return {
      status,
      statusText,
      url,
      message: backendMessage,
      correlationId,
      summary,
      reason,
    };
  }
}
