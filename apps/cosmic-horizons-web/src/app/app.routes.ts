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
    path: 'ephem',
    loadChildren: () =>
      import('./features/ephemeris/ephemeris.module').then((m) => m.EphemerisModule),
    canActivate: [AuthGuard],
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
    path: 'array-telemetry',
    loadChildren: () =>
      import('./features/messaging/messaging.module').then((m) => m.MessagingModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'inference',
    loadChildren: () =>
      import('./features/inference/inference.module').then((m) => m.InferenceModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'jobs-orchestration',
    loadChildren: () =>
      import('./features/job-orchestration/job-orchestration.module').then((m) => m.JobOrchestrationModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'community',
    loadChildren: () => import('./features/community/community.module').then((m) => m.CommunityModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'operations',
    loadChildren: () =>
      import('./modules/operations/operations.module').then((m) => m.OperationsModule),
    canActivate: [AuthGuard, AdminGuard],
  },
  {
    path: '**',
    redirectTo: 'landing',
  },
];
