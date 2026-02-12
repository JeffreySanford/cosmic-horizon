import { Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'landing',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: 'landing',
    loadChildren: () =>
      import('./features/landing/landing.module').then((m) => m.LandingModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'view',
    loadChildren: () =>
      import('./features/viewer/viewer.module').then((m) => m.ViewerModule),
  },
  {
    path: 'posts',
    loadChildren: () =>
      import('./features/posts/posts.module').then((m) => m.PostsModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile/profile.module').then((m) => m.ProfileModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'docs',
    loadChildren: () =>
      import('./features/docs/docs.module').then((m) => m.DocsModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'messaging',
    loadComponent: () =>
      import('./features/messaging/messaging.component').then((m) => m.MessagingComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'moderation',
    loadChildren: () =>
      import('./features/moderation/moderation.module').then((m) => m.ModerationModule),
    canActivate: [AuthGuard, AdminGuard],
  },
  {
    path: 'logs',
    loadChildren: () =>
      import('./features/logs/logs.module').then((m) => m.LogsModule),
    canActivate: [AuthGuard, AdminGuard],
  },
  {
    path: 'jobs',
    loadChildren: () =>
      import('./features/jobs/jobs.module').then((m) => m.JobsModule),
    canActivate: [AuthGuard],
  },
  {
    path: '**',
    redirectTo: 'landing',
  },
];
