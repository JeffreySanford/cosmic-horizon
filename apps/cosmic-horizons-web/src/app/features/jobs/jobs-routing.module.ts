import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { JobsConsoleComponent } from './jobs-console.component';

const routes: Routes = [
  {
    path: '',
    component: JobsConsoleComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JobsRoutingModule {}
