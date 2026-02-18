import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommunityFeedViewComponent } from './community-feed.component';

const routes: Routes = [
  {
    path: '',
    component: CommunityFeedViewComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommunityRoutingModule {}
