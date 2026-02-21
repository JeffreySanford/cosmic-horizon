import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ProfileComponent } from './profile.component';

const routes: Routes = [
  {
    path: '',
    component: ProfileComponent,
    data: {
      header: {
        title: 'Profile',
        icon: 'account_circle',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Profile', icon: 'account_circle' },
        ],
      },
    },
  },
  {
    path: ':username',
    component: ProfileComponent,
    data: {
      header: {
        title: 'User Profile',
        icon: 'badge',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Profile', route: '/profile', icon: 'account_circle' },
          { label: 'User', icon: 'badge' },
        ],
        parentLink: {
          label: 'Back to Profile',
          route: '/profile',
          icon: 'arrow_back',
        },
      },
    },
  },
];

@NgModule({
  declarations: [ProfileComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatCardModule,
    MatButtonModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    MatToolbarModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
})
export class ProfileModule {}
