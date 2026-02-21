import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { PerformanceDataService } from '../../../services/performance-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-progress-graph',
  templateUrl: './progress-graph.component.html',
  styleUrls: ['./progress-graph.component.scss'],
  standalone: false,
  // NgxChartsModule is made available by OperationsModule
})
export class ProgressGraphComponent implements OnInit, OnDestroy {
  // ngx-charts line data structure
  series: unknown[] = [];

  private sub?: Subscription;
  private perf = inject(PerformanceDataService);

  ngOnInit(): void {
    this.sub = this.perf.progressSeries$.subscribe((data) => {
      this.series = data;
    });
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

}
