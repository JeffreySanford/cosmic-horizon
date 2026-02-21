import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { OperationsRoutingModule } from './operations-routing.module';
import { BrokerComparisonComponent } from './broker-comparison/broker-comparison.component';
import { SystemMetricsChartComponent } from './broker-comparison/system-metrics-chart.component';
import { PerformanceHeatmapComponent } from './performance-heatmap/performance-heatmap.component';
import { NodePerformanceComponent } from './node-performance/node-performance.component';
import { ProgressGraphComponent } from './progress-graph/progress-graph.component';
import { LoadTestResultsComponent } from './load-test-results/load-test-results.component';
import { JobDashboardComponent } from './job-dashboard/job-dashboard.component';
import { OperationsHomeComponent } from './operations-home/operations-home.component';

/**
 * OperationsModule (Angular)
 *
 * Operational dashboards and monitoring UI.
 */
@NgModule({
  declarations: [
    BrokerComparisonComponent,
    SystemMetricsChartComponent,
    PerformanceHeatmapComponent,
    NodePerformanceComponent,
    ProgressGraphComponent,
    LoadTestResultsComponent,
    JobDashboardComponent,
    OperationsHomeComponent,
  ],
  exports: [
    PerformanceHeatmapComponent,
    NodePerformanceComponent,
    ProgressGraphComponent,
    LoadTestResultsComponent,
    JobDashboardComponent,
    OperationsHomeComponent,
  ],
  imports: [
    FormsModule,
    CommonModule,
    HttpClientModule,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatIconModule,
    MatTooltipModule,
    // modules required by now‑declared components:
    MatSlideToggleModule,
    MatSliderModule,
    NgxChartsModule,
    OperationsRoutingModule,
    RouterModule,
    MatListModule,
  ],
})
export class OperationsModule {}
