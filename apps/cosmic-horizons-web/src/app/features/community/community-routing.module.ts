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
  },
  {
    path: 'moderation',
    component: ModerationComponent,
    canActivate: [AuthGuard, ModerationGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommunityRoutingModule {}
