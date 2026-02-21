import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ModerationComponent } from './moderation.component';

const routes: Routes = [
  {
    path: '',
    component: ModerationComponent,
    data: {
      header: {
        title: 'Moderation',
        icon: 'gavel',
        iconTone: 'solar',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Community', route: '/community', icon: 'groups' },
          { label: 'Moderation', icon: 'gavel' },
        ],
      },
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ModerationRoutingModule {}
