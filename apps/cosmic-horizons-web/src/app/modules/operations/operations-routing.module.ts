import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BrokerComparisonComponent } from './broker-comparison/broker-comparison.component';
import { JobDashboardComponent } from './job-dashboard/job-dashboard.component';
import { NodePerformanceComponent } from './node-performance/node-performance.component';
import { PerformanceHeatmapComponent } from './performance-heatmap/performance-heatmap.component';
import { ProgressGraphComponent } from './progress-graph/progress-graph.component';
import { LoadTestResultsComponent } from './load-test-results/load-test-results.component';

const routes: Routes = [
  {
    path: 'broker-comparison',
    component: BrokerComparisonComponent,
  },
  {
    path: 'job-dashboard',
    component: JobDashboardComponent,
  },
  {
    path: 'node-performance',
    component: NodePerformanceComponent,
  },
  {
    path: 'heatmap',
    component: PerformanceHeatmapComponent,
  },
  {
    path: 'progress-graph',
    component: ProgressGraphComponent,
  },
  {
    path: 'load-tests',
    component: LoadTestResultsComponent,
  },
  {
    path: '',
    redirectTo: 'broker-comparison',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OperationsRoutingModule {}
