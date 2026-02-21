import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { JobOrchestrationService } from '../../../features/job-orchestration/job-orchestration.service';
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
  private jobService = inject(JobOrchestrationService);

  ngOnInit(): void {
    this.sub = this.jobService.progressSeries$.subscribe((data) => {
      this.series = data;
    });
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

}
