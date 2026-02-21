import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InferenceComponent } from './inference.component';

const routes: Routes = [
  {
    path: '',
    component: InferenceComponent,
    data: {
      header: {
        title: 'Inference',
        icon: 'neurology',
        iconTone: 'violet',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Inference', icon: 'neurology' },
        ],
      },
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InferenceRoutingModule {}
