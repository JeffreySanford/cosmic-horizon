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
  readonly entries$: Observable<AppLogEntry[]> = this.entriesSubject.asObservable();

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

    // Send to backend if not local/debug (optional threshold)
    if (entry.level !== 'debug') {
      this.sendToBackend(entry);
    }
  }

  private async sendToBackend(entry: AppLogEntry): Promise<void> {
    try {
      // Use native fetch to avoid HttpClient interceptors (preventing dependency cycle)
      await fetch('http://localhost:3000/api/logging/remote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: Auth token handling might be needed if AuthenticatedGuard is on this endpoint
          // But usually we want logs to be semi-open or handle auth separately to prevent log loss
        },
        body: JSON.stringify({
          type: entry.area,
          severity: entry.level,
          message: entry.event,
          data: entry.details,
        }),
      });
    } catch {
      // Silent fail for logger to prevent app crash
    }
  }
}

