import { createAction, props } from '@ngrx/store';
import { AppLogEntry } from '../../../services/app-logger.service';

export const logEntryAppended = createAction(
  '[Logs] Entry Appended',
  props<{ entry: AppLogEntry }>(),
);
export const logsCleared = createAction('[Logs] Cleared');
