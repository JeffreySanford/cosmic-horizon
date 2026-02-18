import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityFeedViewComponent } from './community-feed.component';
import { CommunityRoutingModule } from './community-routing.module';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [CommunityFeedViewComponent],
  imports: [CommonModule, CommunityRoutingModule, MatCardModule, MatListModule, MatButtonModule, FormsModule, ReactiveFormsModule],
  exports: [CommunityFeedViewComponent],
})
export class CommunityModule {}
