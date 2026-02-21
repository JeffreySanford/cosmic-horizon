import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Job } from '../../../features/job-orchestration/job.models';
import * as JobsActions from './jobs.actions';

export const jobsFeatureKey = 'jobs';

export interface JobsState extends EntityState<Job> {
  selectedJobId: string | null;
  loading: boolean;
  error: string | null;
}

export const jobsAdapter = createEntityAdapter<Job>({
  selectId: (job) => job.id,
});

export const initialJobsState: JobsState = jobsAdapter.getInitialState({
  selectedJobId: null,
  loading: false,
  error: null,
});

export const jobsReducer = createReducer(
  initialJobsState,
  on(JobsActions.jobsLoadRequested, JobsActions.jobSubmittedRequested, JobsActions.jobCancelledRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(JobsActions.jobsLoadSucceeded, (state, { jobs }) =>
    jobsAdapter.setAll(jobs, {
      ...state,
      loading: false,
      error: null,
    }),
  ),
  on(JobsActions.jobsLoadFailed, JobsActions.jobSubmittedFailed, JobsActions.jobCancelledFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(JobsActions.jobUpdateReceived, (state, { update }) => {
    if (state.entities[update.id]) {
      return jobsAdapter.updateOne(
        {
          id: update.id,
          changes: update,
        },
        state,
      );
    }

    return jobsAdapter.addOne(update as Job, state);
  }),
  on(JobsActions.jobSelected, (state, { jobId }) => ({
    ...state,
    selectedJobId: jobId,
  })),
  on(JobsActions.jobSubmittedSucceeded, (state) => ({
    ...state,
    loading: false,
    error: null,
  })),
  on(JobsActions.jobCancelledSucceeded, (state) => ({
    ...state,
    loading: false,
    error: null,
  })),
);
