import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Static routes - prerendered
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'landing',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/register',
    renderMode: RenderMode.Prerender,
  },

  // Dynamic routes - server-side rendered on-demand
  {
    path: 'view',
    renderMode: RenderMode.Server,
  },
  {
    path: 'view/:shortId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'posts',
    renderMode: RenderMode.Server,
  },
  {
    path: 'posts/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'logs',
    renderMode: RenderMode.Server,
  },
  {
    path: 'auth',
    renderMode: RenderMode.Server,
  },

  // Catch-all route
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
