import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../../shared/material/material.module';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

const authRoutes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    data: {
      header: {
        title: 'Sign In',
        icon: 'login',
        breadcrumbs: [
          { label: 'Auth', route: '/auth/login', icon: 'lock' },
          { label: 'Sign In', icon: 'login' },
        ],
        homeLink: {
          label: 'Sign In',
          route: '/auth/login',
          icon: 'login',
        },
      },
    },
  },
  {
    path: 'register',
    component: RegisterComponent,
    data: {
      header: {
        title: 'Create Account',
        icon: 'person_add',
        iconTone: 'teal',
        breadcrumbs: [
          { label: 'Auth', route: '/auth/login', icon: 'lock' },
          { label: 'Register', icon: 'person_add' },
        ],
        homeLink: {
          label: 'Sign In',
          route: '/auth/login',
          icon: 'login',
        },
        parentLink: {
          label: 'Back to Sign In',
          route: '/auth/login',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];

@NgModule({
  declarations: [LoginComponent, RegisterComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forChild(authRoutes),
  ],
})
export class AuthModule {}
