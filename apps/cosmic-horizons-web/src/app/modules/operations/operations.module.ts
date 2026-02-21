import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OperationsRoutingModule } from './operations-routing.module';
import { BrokerComparisonComponent } from './broker-comparison/broker-comparison.component';
import { SystemMetricsChartComponent } from './broker-comparison/system-metrics-chart.component';
import { JobDashboardComponent } from './job-dashboard/job-dashboard.component';

/**
 * OperationsModule (Angular)
 *
 * Operational dashboards and monitoring UI.
 */
@NgModule({
  declarations: [BrokerComparisonComponent, SystemMetricsChartComponent, JobDashboardComponent],
  imports: [
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
    OperationsRoutingModule,
  ],
})
export class OperationsModule {}
