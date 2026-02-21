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
    data: {
      header: {
        title: 'Sky Viewer',
        icon: 'travel_explore',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Viewer', icon: 'travel_explore' },
        ],
      },
    },
  },
  {
    path: ':shortId',
    component: ViewerComponent,
    data: {
      header: {
        title: 'Sky Snapshot',
        icon: 'photo_camera',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Viewer', route: '/view', icon: 'travel_explore' },
          { label: 'Snapshot', icon: 'photo_camera' },
        ],
        parentLink: {
          label: 'Back to Viewer',
          route: '/view',
          icon: 'arrow_back',
        },
      },
    },
  },
];

@NgModule({
  declarations: [ViewerComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forChild(viewerRoutes),
  ],
})
export class ViewerModule {}
