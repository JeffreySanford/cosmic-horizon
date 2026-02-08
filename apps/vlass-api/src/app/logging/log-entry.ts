export type LogSeverity = 'debug' | 'info' | 'warn' | 'error';
export type LogType = 'http' | 'redis' | 'system';

export interface LogEntry {
  id: string;
  at: string;
  type: LogType;
  severity: LogSeverity;
  message: string;
  data?: Record<string, string | number | boolean | null>;
}
