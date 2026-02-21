import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
import {
  Job,
  JobSubmissionResponse,
} from '../../../features/job-orchestration/job.models';
import { MessagingService } from '../../../services/messaging.service';
import * as JobsActions from './jobs.actions';

@Injectable()
export class JobsEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  private readonly messaging = inject(MessagingService);

  initialize$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobsInitialize),
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
      switchMap(() =>
        this.http.get<Job[]>('/api/jobs').pipe(
          map((jobs) => JobsActions.jobsLoadSucceeded({ jobs })),
          catchError(() =>
            of(JobsActions.jobsLoadFailed({ error: 'Unable to load jobs' })),
          ),
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
          catchError(() =>
            of(
              JobsActions.jobSubmittedFailed({ error: 'Unable to submit job' }),
            ),
          ),
        ),
      ),
    ),
  );

  cancelJob$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.jobCancelledRequested),
      switchMap(({ jobId }) =>
        this.http.post<void>(`/api/jobs/${jobId}/cancel`, {}).pipe(
          mergeMap(() =>
            of(
              JobsActions.jobCancelledSucceeded({ jobId }),
              JobsActions.jobsLoadRequested(),
            ),
          ),
          catchError(() =>
            of(
              JobsActions.jobCancelledFailed({ error: 'Unable to cancel job' }),
            ),
          ),
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
}
