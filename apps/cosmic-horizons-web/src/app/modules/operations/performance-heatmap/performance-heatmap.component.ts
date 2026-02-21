import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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

  ngOnInit(): void {
    this.sub = this.perf.cpuHeatmap$.subscribe((data: number[][]) => {
      this.heatmap = this.convert(data);
    });
    this.lenSub = this.perf.historyLength$.subscribe((len) => {
      // update asynchronously to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.windowCount = len;
        if (this.currentWindow >= len) {
          this.currentWindow = len - 1;
          this.perf.setWindow(this.currentWindow);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.lenSub?.unsubscribe();
  }

  // slider value is now driven by ngModel two‑way binding; we still
  // notify the service when the model changes.
  // the template handles calling `perf.setWindow` via ngModelChange.
  // the older method was removed.
  //
  // onSliderChange(evt: Event) {
  //   const val = (evt.target as HTMLInputElement).valueAsNumber;
  //   this.currentWindow = val;
  //   this.perf.setWindow(val);
  // }


  private convert(data: number[][]) {
    return data.map((row, rowIdx) => ({
      name: `row ${rowIdx}`,
      series: row.map((val, colIdx) => ({ name: `${colIdx}`, value: val })),
    }));
  }
}
