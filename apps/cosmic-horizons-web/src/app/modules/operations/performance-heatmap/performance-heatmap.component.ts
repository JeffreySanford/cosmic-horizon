import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { PerformanceDataService } from '../../../services/performance-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-performance-heatmap',
  templateUrl: './performance-heatmap.component.html',
  styleUrls: ['./performance-heatmap.component.scss'],
  standalone: false,
  // imports are now provided by OperationsModule

})
export class PerformanceHeatmapComponent implements OnInit, OnDestroy {
  // converted to ngx-charts heatmap format
  heatmap: unknown[] = [];
  // slider bounds
  windowCount = 0;
  currentWindow = 0;

  private sub?: Subscription;
  private lenSub?: Subscription;
  // make perf public so templates can call its methods
  public perf = inject(PerformanceDataService);

  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.sub = this.perf.cpuHeatmap$.subscribe((data: number[][]) => {
      // heatmap updates can run during change detection; mark for check
      this.heatmap = this.convert(data);
      this.cdr.markForCheck();
    });
    this.lenSub = this.perf.historyLength$.subscribe((len) => {
      // update asynchronously to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.windowCount = len;
        if (this.currentWindow >= len) {
          this.currentWindow = len - 1;
          this.perf.setWindow(this.currentWindow);
        }
        // ensure change detection picks up latest values
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.lenSub?.unsubscribe();
  }

  // slider value is updated via the input element; we forward to service
  onSliderInput(evt: Event) {
    const val = (evt.target as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(val)) {
      this.currentWindow = val;
      this.perf.setWindow(val);
    }
  }


  private convert(data: number[][]) {
    return data.map((row, rowIdx) => ({
      name: `row ${rowIdx}`,
      series: row.map((val, colIdx) => ({ name: `${colIdx}`, value: val })),
    }));
  }
}
