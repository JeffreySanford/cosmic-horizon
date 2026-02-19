import { Injectable, isDevMode } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

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
  private readonly maxEntries = 500;
  private readonly entries: AppLogEntry[] = [];
  private readonly entriesSubject = new BehaviorSubject<AppLogEntry[]>([]);
  readonly entries$: Observable<AppLogEntry[]> =
    this.entriesSubject.asObservable();

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
    return [...this.entries];
  }

  private push(entry: AppLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    this.entriesSubject.next([...this.entries]);
  }
}
