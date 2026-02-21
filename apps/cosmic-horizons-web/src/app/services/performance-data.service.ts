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
  private readonly selectedIndexSubject = new BehaviorSubject<number>(0);

  constructor() {
    // periodic fetch from backend metrics endpoint
    timer(0, 1000)
      .pipe(
        switchMap(() => this.fetchMatrix()),
      )
      .subscribe((matrix) => this.pushMatrix(matrix));

    // also push a new sample when job updates arrive
    this.messaging.jobUpdate$.subscribe(() => {
      this.fetchMatrix().subscribe((m) => this.pushMatrix(m));
    });
  }

  private fetchMatrix(): Observable<number[][]> {
    return this.http.get<number[][]>('/api/metrics/heatmap').pipe(
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
    // for now mirror CPU
    return this.cpuHeatmap$;
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

  private generateMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.random() * 100),
    );
  }
}
