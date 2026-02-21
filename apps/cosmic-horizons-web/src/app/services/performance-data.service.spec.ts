import { TestBed } from '@angular/core/testing';
import { PerformanceDataService } from './performance-data.service';
import { MessagingService } from './messaging.service';
import { Subject, of, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

describe('PerformanceDataService', () => {
  let service: PerformanceDataService;
  let msg: Partial<MessagingService>;
  let jobUpdates$: Subject<any>;
  let http: Partial<HttpClient>;
  let matrix$: Subject<number[][]>;

  beforeEach(() => {
    jobUpdates$ = new Subject();
    msg = {
      jobUpdate$: jobUpdates$.asObservable(),
    } as any;

    matrix$ = new Subject<number[][]>();
    http = {
      get: vi.fn(() => matrix$.asObservable()),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        PerformanceDataService,
        { provide: MessagingService, useValue: msg },
        { provide: HttpClient, useValue: http },
      ],
    });
    service = TestBed.inject(PerformanceDataService);

    // seed the http stream so timer subscription emits
    matrix$.next([[42]]);
  });

  it('emits heatmap arrays when http endpoint returns and maintains history/progress', async () => {
    // the matrix$ stream has already pushed one value during setup

    // history length should eventually be >=1
    const len = await firstValueFrom(service.historyLength$);
    expect(len).toBeGreaterThan(0);

    // cpuHeatmap$ should produce an array
    const matrix = await firstValueFrom(service.cpuHeatmap$);
    expect(Array.isArray(matrix)).toBe(true);

    // progressSeries$ should reflect at least one window
    const prog = await firstValueFrom(service.progressSeries$);
    expect(Array.isArray(prog)).toBe(true);
  });
});
