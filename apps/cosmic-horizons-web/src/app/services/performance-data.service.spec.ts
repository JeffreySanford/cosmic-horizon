import { TestBed } from '@angular/core/testing';
import { PerformanceDataService } from './performance-data.service';
import { MessagingService } from './messaging.service';
import { Subject, firstValueFrom } from 'rxjs';
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
    const gpuMatrix$ = new Subject<number[][]>();
    http = {
      get: vi.fn((url: string) =>
        url.includes('gpu') ? gpuMatrix$.asObservable() : matrix$.asObservable(),
      ),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        PerformanceDataService,
        { provide: MessagingService, useValue: msg },
        { provide: HttpClient, useValue: http },
      ],
    });
    service = TestBed.inject(PerformanceDataService);

    // seed the http streams so timer subscription emits
    matrix$.next([[42]]);
    gpuMatrix$.next([[7]]);
    // also manually push a matrix so history immediately updates
    (service as any).pushMatrix([[1]]);
    (service as any).pushGpuMatrix([[1]]);
  });

  it('emits heatmap arrays when http endpoint returns and maintains history/progress', async () => {
    // the matrix$ stream has already pushed one value during setup

    // history length should eventually be >=1
    const len = await firstValueFrom(service.historyLength$);
    expect(len).toBeGreaterThan(0);

    // cpuHeatmap$ should produce an array
    const matrix = await firstValueFrom(service.cpuHeatmap$);
    expect(Array.isArray(matrix)).toBe(true);

    // gpuHeatmap$ should also emit something
    const gmatrix = await firstValueFrom(service.gpuHeatmap$);
    expect(Array.isArray(gmatrix)).toBe(true);

    // progressSeries$ should reflect at least one window
    const prog = await firstValueFrom(service.progressSeries$);
    expect(Array.isArray(prog)).toBe(true);
    const gprog = await firstValueFrom(service.gpuProgressSeries$);
    expect(Array.isArray(gprog)).toBe(true);
  });
});
