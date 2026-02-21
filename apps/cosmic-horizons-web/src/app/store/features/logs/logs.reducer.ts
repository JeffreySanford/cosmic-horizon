import { createReducer, on } from '@ngrx/store';
import { AppLogEntry } from '../../../services/app-logger.service';
import * as LogsActions from './logs.actions';

export const logsFeatureKey = 'logs';

export interface LogsState {
  entries: AppLogEntry[];
}

const maxEntries = 500;

export const initialLogsState: LogsState = {
  entries: [],
};

export const logsReducer = createReducer(
  initialLogsState,
  on(LogsActions.logEntryAppended, (state, { entry }) => {
    const entries = [...state.entries, entry];
    return {
      ...state,
      entries: entries.slice(Math.max(0, entries.length - maxEntries)),
    };
  }),
  on(LogsActions.logsCleared, () => initialLogsState),
);
