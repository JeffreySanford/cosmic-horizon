import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, timer, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { MessagingService } from './messaging.service';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class PerformanceDataService {
  private readonly messaging = inject(MessagingService);
  private readonly http = inject(HttpClient);

  // keep a sliding window of matrices; each matrix is rows x cols
  private readonly historySubject = new BehaviorSubject<number[][][]>([]);
  private readonly gpuHistorySubject = new BehaviorSubject<number[][][]>([]);
  private readonly selectedIndexSubject = new BehaviorSubject<number>(0);


  constructor() {
    // periodic fetch from backend metrics endpoint
    timer(0, 1000)
      .pipe(
        switchMap(() => this.fetchMatrix()),
      )
      .subscribe((matrix) => this.pushMatrix(matrix));

    // optionally pull GPU metrics if backend provides
    timer(0, 1000)
      .pipe(
        switchMap(() => this.fetchGpuMatrix()),
      )
      .subscribe((matrix) => this.pushGpuMatrix(matrix));

    // also push a new sample when job updates arrive
    this.messaging.jobUpdate$.subscribe(() => {
      this.fetchMatrix().subscribe((m) => this.pushMatrix(m));
      this.fetchGpuMatrix().subscribe((m) => this.pushGpuMatrix(m));
    });
  }

  private fetchMatrix(): Observable<number[][]> {
    return this.http.get<number[][]>('/api/metrics/heatmap').pipe(
      catchError(() => of(this.generateMatrix(10, 10))),
    );
  }

  private fetchGpuMatrix(): Observable<number[][]> {
    return this.http.get<number[][]>('/api/metrics/gpu-heatmap').pipe(
      catchError(() => of(this.generateMatrix(10, 10))),
    );
  }

  private pushMatrix(matrix: number[][]) {
    const old = this.historySubject.value;
    const next = [...old, matrix].slice(-20);
    this.historySubject.next(next);
    if (this.selectedIndexSubject.value >= next.length) {
      this.selectedIndexSubject.next(next.length - 1);
    }
  }

  private pushGpuMatrix(matrix: number[][]) {
    const old = this.gpuHistorySubject.value;
    const next = [...old, matrix].slice(-20);
    this.gpuHistorySubject.next(next);
  }

  /** expose number of available windows */
  get historyLength$(): Observable<number> {
    return this.historySubject.pipe(map((h) => h.length));
  }

  /** choose which window to display */
  setWindow(index: number) {
    const len = this.historySubject.value.length;
    if (index < 0) index = 0;
    if (index >= len) index = len - 1;
    this.selectedIndexSubject.next(index);
  }

  /** heatmap slice corresponding to selected window */
  get cpuHeatmap$(): Observable<number[][]> {
    return combineLatest([this.historySubject, this.selectedIndexSubject]).pipe(
      map(([h, idx]) => h[idx] || []),
    );
  }

  /** optional GPU stream if needed */
  get gpuHeatmap$(): Observable<number[][]> {
    return combineLatest([this.gpuHistorySubject, this.selectedIndexSubject]).pipe(
      map(([h, idx]) => h[idx] || []),
    );
  }

  /** expose number of GPU windows available */
  get gpuHistoryLength$(): Observable<number> {
    return this.gpuHistorySubject.pipe(map((h) => h.length));
  }

  /** derived progress series: average CPU value per window */
  get progressSeries$(): Observable<{ name: string; series: { name: string; value: number }[] }[]> {
    return this.historySubject.pipe(
      map((h) =>
        h.map((m, idx) => {
          const total = m.flat().reduce((a, b) => a + b, 0);
          const avg = total / (m.length * (m[0]?.length || 1));
          return {
            name: `window ${idx}`,
            series: [{ name: 'avg', value: Math.round(avg) }],
          };
        }),
      ),
    );
  }

  /** derived GPU average per window (same shape as progressSeries$) */
  get gpuProgressSeries$(): Observable<{ name: string; series: { name: string; value: number }[] }[]> {
    return this.gpuHistorySubject.pipe(
      map((h) =>
        h.map((m, idx) => {
          const total = m.flat().reduce((a, b) => a + b, 0);
          const avg = total / (m.length * (m[0]?.length || 1));
          return {
            name: `window ${idx}`,
            series: [{ name: 'avg', value: Math.round(avg) }],
          };
        }),
      ),
    );
  }

  private generateMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.random() * 100),
    );
  }
}
