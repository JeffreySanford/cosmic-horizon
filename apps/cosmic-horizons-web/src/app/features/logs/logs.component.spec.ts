import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AppLogEntry,
  AppLoggerService,
} from '../../services/app-logger.service';
import { LogsComponent } from './logs.component';

describe('LogsComponent', () => {
  let fixture: ComponentFixture<LogsComponent>;
  let component: LogsComponent;
  let entriesSubject: BehaviorSubject<AppLogEntry[]>;
  let appLoggerService: Pick<AppLoggerService, 'entries$'>;

  beforeEach(async () => {
    entriesSubject = new BehaviorSubject<AppLogEntry[]>([
      {
        at: '2026-02-08T01:00:00.000Z',
        area: 'viewer',
        event: 'aladin_initialized',
        level: 'info',
        details: { grid_enabled: false },
      },
      {
        at: '2026-02-08T01:01:00.000Z',
        area: 'viewer',
        event: 'tile_cache_snapshot',
        level: 'debug',
      },
    ]);

    appLoggerService = { entries$: entriesSubject };

    await TestBed.configureTestingModule({
      declarations: [LogsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: AppLoggerService, useValue: appLoggerService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads logger entries from live stream on init', () => {
    expect(component.totalEntries).toBe(2);
    expect(component.filteredEntries).toBe(2);
    expect(component.dataSource.data[0]?.event).toBe('tile_cache_snapshot');
  });

  it('filters to verbose entries when verbose tile is selected', () => {
    component.setFilter('verbose');
    expect(component.filteredEntries).toBe(1);
    expect(component.dataSource.data[0]?.level).toBe('debug');
  });

  it('updates table when new stream entries arrive', () => {
    entriesSubject.next([
      ...entriesSubject.value,
      {
        at: '2026-02-08T01:02:00.000Z',
        area: 'auth',
        event: 'login_failed',
        level: 'error',
        details: { status_code: 401, user_email: 'astro@demo.local' },
      },
    ]);

    expect(component.totalEntries).toBe(3);
    expect(component.tiles.find((tile) => tile.id === 'errors')?.count).toBe(1);
    expect(component.dataSource.data[0]?.event).toBe('login_failed');
  });
});
