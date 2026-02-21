import { createAction, props } from '@ngrx/store';
import {
  Job,
  JobSubmissionRequest,
  JobSubmissionResponse,
} from '../../../features/job-orchestration/job.models';

export const jobsInitialize = createAction('[Jobs] Initialize');
export const jobsLoadRequested = createAction('[Jobs] Load Requested');
export const jobsLoadSucceeded = createAction(
  '[Jobs] Load Succeeded',
  props<{ jobs: Job[] }>(),
);
export const jobsLoadFailed = createAction(
  '[Jobs] Load Failed',
  props<{ error: string }>(),
);

export const jobSubmittedRequested = createAction(
  '[Jobs] Submitted Requested',
  props<{ request: JobSubmissionRequest }>(),
);
export const jobSubmittedSucceeded = createAction(
  '[Jobs] Submitted Succeeded',
  props<{ response: JobSubmissionResponse }>(),
);
export const jobSubmittedFailed = createAction(
  '[Jobs] Submitted Failed',
  props<{ error: string }>(),
);

export const jobCancelledRequested = createAction(
  '[Jobs] Cancelled Requested',
  props<{ jobId: string }>(),
);
export const jobCancelledSucceeded = createAction(
  '[Jobs] Cancelled Succeeded',
  props<{ jobId: string }>(),
);
export const jobCancelledFailed = createAction(
  '[Jobs] Cancelled Failed',
  props<{ error: string }>(),
);

export const jobUpdateReceived = createAction(
  '[Jobs] Job Update Received',
  props<{ update: Partial<Job> & { id: string } }>(),
);

export const jobSelected = createAction(
  '[Jobs] Selected',
  props<{ jobId: string | null }>(),
);
