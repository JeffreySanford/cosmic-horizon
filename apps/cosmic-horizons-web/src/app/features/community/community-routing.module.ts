import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommunityFeedComponent } from './community-feed.component';
import { ModerationComponent } from './moderation.component';
import { AuthGuard } from '../../guards/auth.guard';
import { ModerationGuard } from '../../guards/moderation.guard';

const routes: Routes = [
  {
    path: '',
    component: CommunityFeedComponent,
    data: {
      header: {
        title: 'Community Feed',
        icon: 'groups',
        iconTone: 'violet',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Community', icon: 'groups' },
        ],
      },
    },
  },
  {
    path: 'moderation',
    component: ModerationComponent,
    canActivate: [AuthGuard, ModerationGuard],
    data: {
      header: {
        title: 'Community Moderation',
        icon: 'rule',
        iconTone: 'solar',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Community', route: '/community', icon: 'groups' },
          { label: 'Moderation', icon: 'rule' },
        ],
        parentLink: {
          label: 'Back to Community',
          route: '/community',
          icon: 'arrow_back',
        },
      },
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommunityRoutingModule {}
