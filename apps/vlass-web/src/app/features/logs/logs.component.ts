import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { BehaviorSubject, Subject, combineLatest } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { AppLogEntry, AppLoggerService, LogDetails, LogDetailValue } from '../../services/app-logger.service';

type LogTileFilter = 'all' | 'verbose' | 'errors' | 'warnings' | 'info';

interface LogLevelTile {
  id: LogTileFilter;
  label: string;
  count: number;
}

interface LogRow {
  at: string;
  level: AppLogEntry['level'];
  area: string;
  event: string;
  message: string;
  status: string;
  user: string;
  context: string;
}

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class LogsComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly displayedColumns = ['at', 'level', 'area', 'event', 'message', 'status', 'user', 'context'];
  readonly dataSource = new MatTableDataSource<LogRow>([]);
  readonly tiles: LogLevelTile[] = [
    { id: 'all', label: 'All', count: 0 },
    { id: 'verbose', label: 'Verbose', count: 0 },
    { id: 'errors', label: 'Errors', count: 0 },
    { id: 'warnings', label: 'Warnings', count: 0 },
    { id: 'info', label: 'Info', count: 0 },
  ];

  selectedFilter: LogTileFilter = 'all';
  totalEntries = 0;
  filteredEntries = 0;

  private readonly appLogger = inject(AppLoggerService);
  private readonly destroy$ = new Subject<void>();
  private readonly filter$ = new BehaviorSubject<LogTileFilter>('all');

  @ViewChild(MatSort) sort?: MatSort;

  ngOnInit(): void {
    this.configureSorting();

    combineLatest([this.appLogger.entries$, this.filter$])
      .pipe(
        map(([entries, filter]) => {
          const rows = entries.map((entry) => this.toRow(entry)).reverse();
          return {
            rows: this.applyFilter(rows, filter),
            counts: this.countTiles(rows),
            total: rows.length,
          };
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(({ rows, counts, total }) => {
        this.totalEntries = total;
        this.filteredEntries = rows.length;
        this.dataSource.data = rows;
        this.tiles.forEach((tile) => {
          tile.count = counts[tile.id];
        });
      });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setFilter(filter: LogTileFilter): void {
    this.selectedFilter = filter;
    this.filter$.next(filter);
  }

  levelLabel(level: AppLogEntry['level']): string {
    switch (level) {
      case 'debug':
        return 'VERBOSE';
      case 'warn':
        return 'WARNING';
      case 'error':
        return 'ERROR';
      default:
        return 'INFO';
    }
  }

  private configureSorting(): void {
    const severityOrder: Record<AppLogEntry['level'], number> = {
      error: 4,
      warn: 3,
      info: 2,
      debug: 1,
    };

    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'at':
          return Date.parse(row.at);
        case 'level':
          return severityOrder[row.level];
        case 'status':
          return Number(row.status) || -1;
        default:
          return (row[column as keyof LogRow] ?? '').toString().toLowerCase();
      }
    };
  }

  private countTiles(rows: LogRow[]): Record<LogTileFilter, number> {
    return {
      all: rows.length,
      verbose: rows.filter((row) => row.level === 'debug').length,
      errors: rows.filter((row) => row.level === 'error').length,
      warnings: rows.filter((row) => row.level === 'warn').length,
      info: rows.filter((row) => row.level === 'info').length,
    };
  }

  private applyFilter(rows: LogRow[], filter: LogTileFilter): LogRow[] {
    switch (filter) {
      case 'verbose':
        return rows.filter((row) => row.level === 'debug');
      case 'errors':
        return rows.filter((row) => row.level === 'error');
      case 'warnings':
        return rows.filter((row) => row.level === 'warn');
      case 'info':
        return rows.filter((row) => row.level === 'info');
      default:
        return rows;
    }
  }

  private toRow(entry: AppLogEntry): LogRow {
    const details: LogDetails = entry.details ?? {};
    const status = this.pickValue(details, ['status_code', 'status']) ?? '-';
    const user = this.pickValue(details, ['user_email', 'email', 'user_id']) ?? '-';
    const message = this.pickValue(details, ['message', 'error', 'reason']) ?? '-';
    const ignored = new Set(['status_code', 'status', 'user_email', 'email', 'user_id', 'message', 'error', 'reason']);
    const context = Object.entries(details)
      .filter(([key]) => !ignored.has(key))
      .map(([key, value]) => `${key.replace(/_/g, ' ')}=${this.readableValue(value)}`)
      .join(' | ');

    return {
      at: entry.at,
      level: entry.level,
      area: entry.area,
      event: entry.event,
      message,
      status,
      user,
      context: context || '-',
    };
  }

  private pickValue(details: LogDetails, keys: string[]): string | null {
    for (const key of keys) {
      const value = details[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return null;
  }

  private readableValue(value: LogDetailValue): string {
    if (value === null) return 'null';
    return String(value);
  }
}
