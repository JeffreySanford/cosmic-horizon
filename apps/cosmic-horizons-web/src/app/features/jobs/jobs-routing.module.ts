import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { JobsConsoleComponent } from './jobs-console.component';

const routes: Routes = [
  {
    path: '',
    component: JobsConsoleComponent,
    data: {
      header: {
        title: 'Jobs Console',
        icon: 'work_history',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Jobs', icon: 'work_history' },
        ],
      },
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JobsRoutingModule {}
