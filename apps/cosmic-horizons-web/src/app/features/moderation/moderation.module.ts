import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ModerationRoutingModule } from './moderation-routing.module';
import { ModerationComponent } from './moderation.component';

@NgModule({
  declarations: [ModerationComponent],
  imports: [
    CommonModule,
    ModerationRoutingModule,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
})
export class ModerationModule {}
