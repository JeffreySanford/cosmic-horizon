import { createFeatureSelector, createSelector } from '@ngrx/store';
import { jobsAdapter, JobsState, jobsFeatureKey } from './jobs.reducer';

export const selectJobsState = createFeatureSelector<JobsState>(jobsFeatureKey);

const adapterSelectors = jobsAdapter.getSelectors(selectJobsState);

export const selectAllJobs = adapterSelectors.selectAll;
export const selectJobsEntities = adapterSelectors.selectEntities;
export const selectJobsLoading = createSelector(selectJobsState, (state) => state.loading);
export const selectJobsError = createSelector(selectJobsState, (state) => state.error);
export const selectSelectedJobId = createSelector(selectJobsState, (state) => state.selectedJobId);
export const selectSelectedJob = createSelector(
  selectJobsEntities,
  selectSelectedJobId,
  (entities, selectedId) => (selectedId ? entities[selectedId] ?? null : null),
);

export const selectJobCount = createSelector(selectAllJobs, (jobs) => jobs.length);

export const selectProgressSeries = createSelector(selectAllJobs, (jobs) =>
  jobs.map((job) => ({
    name: job.name,
    series: (job.progressHistory || []).map((h) => ({ name: h.time, value: h.progress })),
  })),
);
