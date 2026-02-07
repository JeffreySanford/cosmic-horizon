import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../../shared/material/material.module';
import { ViewerComponent } from './viewer.component';

const viewerRoutes: Routes = [
  {
    path: '',
    component: ViewerComponent,
  },
  {
    path: ':shortId',
    component: ViewerComponent,
  },
];

@NgModule({
  declarations: [ViewerComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule, RouterModule.forChild(viewerRoutes)],
})
export class ViewerModule {}
