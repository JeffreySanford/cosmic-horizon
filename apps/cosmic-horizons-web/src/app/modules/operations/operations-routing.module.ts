import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BrokerComparisonComponent } from './broker-comparison/broker-comparison.component';
import { JobDashboardComponent } from './job-dashboard/job-dashboard.component';

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
