import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MessagingComponent } from './messaging.component';

const messagingRoutes: Routes = [
  {
    path: '',
    component: MessagingComponent,
  },
];

@NgModule({
  declarations: [MessagingComponent],
  imports: [CommonModule, RouterModule.forChild(messagingRoutes)],
})
export class MessagingModule {}
