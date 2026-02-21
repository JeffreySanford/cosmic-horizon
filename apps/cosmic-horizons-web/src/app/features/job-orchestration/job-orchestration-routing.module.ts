import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { JobOrchestrationComponent } from './job-orchestration.component';

const routes: Routes = [
  {
    path: '',
    component: JobOrchestrationComponent,
    data: {
      header: {
        title: 'Job Orchestration',
        icon: 'lan',
        iconTone: 'aurora',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Job Orchestration', icon: 'lan' },
        ],
      },
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JobOrchestrationRoutingModule {}
