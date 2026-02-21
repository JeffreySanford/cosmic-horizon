import { createFeatureSelector, createSelector } from '@ngrx/store';
import { logsFeatureKey, LogsState } from './logs.reducer';

export const selectLogsState = createFeatureSelector<LogsState>(logsFeatureKey);
export const selectLogEntries = createSelector(
  selectLogsState,
  (state) => state.entries,
);
