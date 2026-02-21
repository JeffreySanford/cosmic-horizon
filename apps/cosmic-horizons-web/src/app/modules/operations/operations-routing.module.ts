import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BrokerComparisonComponent } from './broker-comparison/broker-comparison.component';
import { JobDashboardComponent } from './job-dashboard/job-dashboard.component';
import { NodePerformanceComponent } from './node-performance/node-performance.component';
import { PerformanceHeatmapComponent } from './performance-heatmap/performance-heatmap.component';
import { ProgressGraphComponent } from './progress-graph/progress-graph.component';
import { LoadTestResultsComponent } from './load-test-results/load-test-results.component';
import { OperationsHomeComponent } from './operations-home/operations-home.component';

const routes: Routes = [
  {
    path: '',
    component: OperationsHomeComponent,
    data: {
      header: {
        title: 'Operations Center',
        icon: 'monitoring',
        iconTone: 'slate',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', icon: 'monitoring' },
        ],
      },
    },
  },
  {
    path: 'broker-comparison',
    component: BrokerComparisonComponent,
    data: {
      header: {
        title: 'Broker Comparison',
        icon: 'compare_arrows',
        iconTone: 'slate',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', route: '/operations', icon: 'monitoring' },
          { label: 'Broker Comparison', icon: 'compare_arrows' },
        ],
        parentLink: {
          label: 'Back to Operations',
          route: '/operations',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: 'job-dashboard',
    component: JobDashboardComponent,
    data: {
      header: {
        title: 'Operations Job Dashboard',
        icon: 'dashboard',
        iconTone: 'slate',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', route: '/operations', icon: 'monitoring' },
          { label: 'Job Dashboard', icon: 'dashboard' },
        ],
        parentLink: {
          label: 'Back to Operations',
          route: '/operations',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: 'node-performance',
    component: NodePerformanceComponent,
    data: {
      header: {
        title: 'Node Performance',
        icon: 'memory',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', route: '/operations', icon: 'monitoring' },
          { label: 'Node Performance', icon: 'memory' },
        ],
        parentLink: {
          label: 'Back to Operations',
          route: '/operations',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: 'heatmap',
    component: PerformanceHeatmapComponent,
    data: {
      header: {
        title: 'Performance Heatmap',
        icon: 'grid_view',
        iconTone: 'solar',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', route: '/operations', icon: 'monitoring' },
          { label: 'Heatmap', icon: 'grid_view' },
        ],
        parentLink: {
          label: 'Back to Operations',
          route: '/operations',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: 'progress-graph',
    component: ProgressGraphComponent,
    data: {
      header: {
        title: 'Progress Graph',
        icon: 'multiline_chart',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', route: '/operations', icon: 'monitoring' },
          { label: 'Progress Graph', icon: 'multiline_chart' },
        ],
        parentLink: {
          label: 'Back to Operations',
          route: '/operations',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: 'load-tests',
    component: LoadTestResultsComponent,
    data: {
      header: {
        title: 'Load Test Results',
        icon: 'query_stats',
        iconTone: 'solar',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', route: '/operations', icon: 'monitoring' },
          { label: 'Load Tests', icon: 'query_stats' },
        ],
        parentLink: {
          label: 'Back to Operations',
          route: '/operations',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OperationsRoutingModule {}
