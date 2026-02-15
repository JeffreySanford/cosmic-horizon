import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';

import { InferenceComponent } from './inference.component';
import { PermissionModalComponent } from './permission-modal/permission-modal.component';
import { InferenceRoutingModule } from './inference-routing.module';

@NgModule({
  declarations: [InferenceComponent, PermissionModalComponent],
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDialogModule,
    InferenceRoutingModule,
  ],
  exports: [InferenceComponent],
})
export class InferenceModule {}
