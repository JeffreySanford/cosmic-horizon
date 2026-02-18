import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityFeedComponent } from './community-feed.component';
import { CommunityRoutingModule } from './community-routing.module';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [CommunityFeedComponent],
  imports: [CommonModule, CommunityRoutingModule, MatCardModule, MatListModule, MatButtonModule, FormsModule, ReactiveFormsModule],
  exports: [CommunityFeedComponent],
})
export class CommunityModule {}
