import { inject, Injectable, isDevMode } from '@angular/core';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import * as LogsActions from '../store/features/logs/logs.actions';
import { selectLogEntries } from '../store/features/logs/logs.selectors';
import { AppState } from '../store/app.state';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogDetailValue = boolean | number | string | null;
export type LogDetails = Record<string, LogDetailValue>;

export interface AppLogEntry {
  at: string;
  area: string;
  event: string;
  level: LogLevel;
  details?: LogDetails;
}

@Injectable({
  providedIn: 'root',
})
export class AppLoggerService {
  readonly entries$: Observable<AppLogEntry[]>;
  private latestEntries: AppLogEntry[] = [];
  private readonly store = inject<Store<AppState>>(Store);

  constructor() {
    this.entries$ = this.store.select(selectLogEntries);

    this.entries$.subscribe((entries) => {
      this.latestEntries = entries;
    });
  }

  info(area: string, event: string, details?: LogDetails): void {
    this.push({
      at: new Date().toISOString(),
      area,
      event,
      level: 'info',
      details,
    });
  }

  debug(area: string, event: string, details?: LogDetails): void {
    if (!isDevMode()) {
      return;
    }

    this.push({
      at: new Date().toISOString(),
      area,
      event,
      level: 'debug',
      details,
    });
  }

  warn(area: string, event: string, details?: LogDetails): void {
    this.push({
      at: new Date().toISOString(),
      area,
      event,
      level: 'warn',
      details,
    });
  }

  error(area: string, event: string, details?: LogDetails): void {
    this.push({
      at: new Date().toISOString(),
      area,
      event,
      level: 'error',
      details,
    });
  }

  snapshot(): AppLogEntry[] {
    return [...this.latestEntries];
  }

  private push(entry: AppLogEntry): void {
    this.store.dispatch(LogsActions.logEntryAppended({ entry }));
  }
}
