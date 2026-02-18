import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommunityFeedComponent } from './community-feed.component';

const routes: Routes = [
  {
    path: '',
    component: CommunityFeedComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommunityRoutingModule {}
