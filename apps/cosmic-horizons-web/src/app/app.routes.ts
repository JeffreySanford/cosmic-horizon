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
    data: {
      hideAppHeader: true,
      header: {
        title: 'Authentication',
        icon: 'lock',
        iconTone: 'slate',
        subtitle: 'Secure account access',
        showUserMenu: false,
        breadcrumbs: [{ label: 'Auth', icon: 'lock' }],
      },
    },
  },
  {
    path: 'landing',
    loadChildren: () =>
      import('./features/landing/landing.module').then((m) => m.LandingModule),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Cosmic Horizons Landing',
        icon: 'rocket_launch',
        iconTone: 'aurora',
        showQuickStats: false,
        allowExpand: true,
        expandedByDefault: true,
        expandLabel: 'ngVLA Scale Highlights',
        insights: [
          {
            icon: 'bolt',
            value: '7.5-8 GB/s',
            label: 'Raw visibility ingest',
          },
          {
            icon: 'storage',
            value: '240 PB/yr',
            label: 'Archive growth horizon',
          },
          {
            icon: 'speed',
            value: '< 1s SSR',
            label: 'First paint target',
          },
        ],
        breadcrumbs: [{ label: 'Home', route: '/landing', icon: 'home' }],
      },
    },
  },
  {
    path: 'view',
    loadChildren: () =>
      import('./features/viewer/viewer.module').then((m) => m.ViewerModule),
    data: {
      header: {
        title: 'Sky Viewer',
        icon: 'travel_explore',
        iconTone: 'teal',
        subtitle: 'Inspect science-ready visual products',
        allowExpand: true,
        expandLabel: 'Viewer Snapshot',
        insights: [
          {
            icon: 'image_search',
            value: 'Sky Navigation',
            label: 'Explore tiles, overlays, and targets quickly',
          },
          {
            icon: 'link',
            value: 'Shareable State',
            label: 'Use permalink-ready encoded viewer context',
          },
          {
            icon: 'photo_camera',
            value: 'Snapshots',
            label: 'Capture reproducible visual references',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Viewer', route: '/view', icon: 'travel_explore' },
        ],
      },
    },
  },
  {
    path: 'ephem',
    loadChildren: () =>
      import('./features/ephemeris/ephemeris.module').then(
        (m) => m.EphemerisModule,
      ),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Ephemeris',
        icon: 'public',
        iconTone: 'solar',
        subtitle: 'Orbital and object visibility calculations',
        allowExpand: true,
        expandLabel: 'Ephemeris Focus',
        insights: [
          {
            icon: 'public',
            value: 'Object Positioning',
            label: 'Calculate celestial body visibility windows',
          },
          {
            icon: 'schedule',
            value: 'Observation Timing',
            label: 'Align target windows to mission planning',
          },
          {
            icon: 'precision_manufacturing',
            value: 'Science Precision',
            label: 'Support deterministic planning workflows',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Ephemeris', icon: 'public' },
        ],
      },
    },
  },
  {
    path: 'posts',
    loadChildren: () =>
      import('./features/posts/posts.module').then((m) => m.PostsModule),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Community Posts',
        icon: 'forum',
        iconTone: 'violet',
        subtitle: 'Discoveries, notes, and discussion',
        allowExpand: true,
        expandLabel: 'Community Signals',
        insights: [
          {
            icon: 'forum',
            value: 'Research Threads',
            label: 'Track discoveries and collaborative notes',
          },
          {
            icon: 'edit_note',
            value: 'Authoring',
            label: 'Publish structured science updates',
          },
          {
            icon: 'groups',
            value: 'Peer Review',
            label: 'Enable human-in-the-loop validation',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Posts', route: '/posts', icon: 'forum' },
        ],
      },
    },
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile/profile.module').then((m) => m.ProfileModule),
    data: {
      header: {
        title: 'Profile',
        icon: 'account_circle',
        iconTone: 'teal',
        subtitle: 'Account settings and activity',
        allowExpand: true,
        expandLabel: 'Profile Controls',
        insights: [
          {
            icon: 'badge',
            value: 'Identity',
            label: 'Manage display identity and account details',
          },
          {
            icon: 'my_location',
            value: 'Exact Location',
            label: 'Configure precise location preferences',
          },
          {
            icon: 'history',
            value: 'Recent Activity',
            label: 'Review authored and interaction history',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Profile', icon: 'account_circle' },
        ],
      },
    },
  },
  {
    path: 'docs',
    loadChildren: () =>
      import('./features/docs/docs.module').then((m) => m.DocsModule),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Documentation',
        icon: 'description',
        iconTone: 'slate',
        subtitle: 'System references and guides',
        allowExpand: true,
        expandLabel: 'Documentation Scope',
        insights: [
          {
            icon: 'menu_book',
            value: 'Reference Guides',
            label: 'Find platform and workflow documentation',
          },
          {
            icon: 'build',
            value: 'Operational How-To',
            label: 'Follow setup and execution procedures',
          },
          {
            icon: 'verified',
            value: 'Source of Truth',
            label: 'Keep teams aligned on implementation details',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Docs', route: '/docs', icon: 'description' },
        ],
      },
    },
  },
  {
    path: 'moderation',
    loadChildren: () =>
      import('./features/moderation/moderation.module').then(
        (m) => m.ModerationModule,
      ),
    canActivate: [AuthGuard, AdminGuard],
    data: {
      header: {
        title: 'Moderation',
        icon: 'gavel',
        iconTone: 'solar',
        subtitle: 'Review and resolve moderation queue',
        allowExpand: true,
        expandLabel: 'Moderation Workflow',
        insights: [
          {
            icon: 'rule',
            value: 'Policy Review',
            label: 'Validate reports against moderation policy',
          },
          {
            icon: 'assignment_turned_in',
            value: 'Case Resolution',
            label: 'Close moderation items with clear outcomes',
          },
          {
            icon: 'shield',
            value: 'Trust Controls',
            label: 'Maintain community safety and quality',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Community', route: '/community', icon: 'groups' },
          { label: 'Moderation', icon: 'gavel' },
        ],
      },
    },
  },
  {
    path: 'alerts',
    loadChildren: () =>
      import('./features/alerts/alerts.module').then((m) => m.AlertsModule),
    canActivate: [AuthGuard, AdminGuard],
    data: {
      header: {
        title: 'Alerts',
        icon: 'notifications_active',
        iconTone: 'solar',
        subtitle: 'Live system alerts and escalation',
        allowExpand: true,
        expandLabel: 'Alert Surface',
        insights: [
          {
            icon: 'warning',
            value: 'Active Signals',
            label: 'View active and recent platform alerts',
          },
          {
            icon: 'bolt',
            value: 'Escalation',
            label: 'Prioritize incidents by urgency',
          },
          {
            icon: 'campaign',
            value: 'Operator Awareness',
            label: 'Broadcast actionable incident context',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Alerts', icon: 'notifications_active' },
        ],
      },
    },
  },
  {
    path: 'logs',
    loadChildren: () =>
      import('./features/logs/logs.module').then((m) => m.LogsModule),
    canActivate: [AuthGuard, AdminGuard],
    data: {
      header: {
        title: 'Audit Logs',
        icon: 'receipt_long',
        iconTone: 'slate',
        subtitle: 'Investigate system and user history',
        allowExpand: true,
        expandLabel: 'Audit Trail Lens',
        insights: [
          {
            icon: 'fact_check',
            value: 'Event Trace',
            label: 'Inspect critical system and user events',
          },
          {
            icon: 'manage_search',
            value: 'Investigations',
            label: 'Correlate changes and operational outcomes',
          },
          {
            icon: 'history_edu',
            value: 'Compliance',
            label: 'Support review and trust requirements',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Logs', icon: 'receipt_long' },
        ],
      },
    },
  },
  {
    path: 'jobs',
    loadChildren: () =>
      import('./features/jobs/jobs.module').then((m) => m.JobsModule),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Jobs Console',
        icon: 'work_history',
        iconTone: 'teal',
        subtitle: 'Inspect runtime and queued jobs',
        allowExpand: true,
        expandLabel: 'Jobs At A Glance',
        insights: [
          {
            icon: 'schedule',
            value: 'Queue + Runtime',
            label: 'Track queued, running, and completed jobs',
          },
          {
            icon: 'hub',
            value: 'Agent Coverage',
            label: 'View agent execution distribution',
          },
          {
            icon: 'insights',
            value: 'Live Status',
            label: 'Monitor progress and outcomes in real time',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Jobs', icon: 'work_history' },
        ],
      },
    },
  },
  {
    path: 'array-telemetry',
    loadChildren: () =>
      import('./features/messaging/messaging.module').then(
        (m) => m.MessagingModule,
      ),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Array Telemetry',
        icon: 'sensors',
        iconTone: 'teal',
        subtitle: 'Real-time node and broker observability',
        allowExpand: true,
        expandLabel: 'Telemetry Focus',
        insights: [
          {
            icon: 'speed',
            value: 'Live Throughput',
            label: 'Observe packet and broker flow rates',
          },
          {
            icon: 'router',
            value: 'Fabric Health',
            label: 'Watch rabbitmq and kafka connectivity',
          },
          {
            icon: 'track_changes',
            value: 'Signal State',
            label: 'Track streaming telemetry changes',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Array Telemetry', icon: 'sensors' },
        ],
      },
    },
  },
  {
    path: 'inference',
    loadChildren: () =>
      import('./features/inference/inference.module').then(
        (m) => m.InferenceModule,
      ),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Inference',
        icon: 'neurology',
        iconTone: 'violet',
        subtitle: 'Run and review autonomous model pipelines',
        allowExpand: true,
        expandLabel: 'Inference Objectives',
        insights: [
          {
            icon: 'model_training',
            value: 'Model Runs',
            label: 'Execute and monitor AI pipeline jobs',
          },
          {
            icon: 'checklist',
            value: 'Human Review',
            label: 'Preserve audit and validation checkpoints',
          },
          {
            icon: 'auto_awesome',
            value: 'Science Ready',
            label: 'Surface explainable model outcomes fast',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Inference', icon: 'neurology' },
        ],
      },
    },
  },
  {
    path: 'jobs-orchestration',
    loadChildren: () =>
      import('./features/job-orchestration/job-orchestration.module').then(
        (m) => m.JobOrchestrationModule,
      ),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Job Orchestration',
        icon: 'lan',
        iconTone: 'aurora',
        subtitle: 'Launch and supervise distributed processing',
        allowExpand: true,
        expandLabel: 'Orchestration Focus',
        insights: [
          {
            icon: 'playlist_add_check_circle',
            value: 'Submission Control',
            label: 'Create and validate reprocessing jobs',
          },
          {
            icon: 'dns',
            value: 'Resource Routing',
            label: 'Coordinate agent workloads across services',
          },
          {
            icon: 'monitor_heart',
            value: 'Execution Health',
            label: 'Track lifecycle and failure conditions',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Job Orchestration', icon: 'lan' },
        ],
      },
    },
  },
  {
    path: 'community',
    loadChildren: () =>
      import('./features/community/community.module').then(
        (m) => m.CommunityModule,
      ),
    canActivate: [AuthGuard],
    data: {
      header: {
        title: 'Community',
        icon: 'groups',
        iconTone: 'violet',
        subtitle: 'Discoveries and collaborative science threads',
        allowExpand: true,
        expandLabel: 'Community Hub',
        insights: [
          {
            icon: 'diversity_3',
            value: 'Collaboration',
            label: 'Coordinate discoveries across contributors',
          },
          {
            icon: 'newspaper',
            value: 'Research Feed',
            label: 'Follow curated community updates',
          },
          {
            icon: 'mark_chat_read',
            value: 'Moderated Trust',
            label: 'Balance openness with policy enforcement',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Community', route: '/community', icon: 'groups' },
        ],
      },
    },
  },
  {
    path: 'operations',
    loadChildren: () =>
      import('./modules/operations/operations.module').then(
        (m) => m.OperationsModule,
      ),
    canActivate: [AuthGuard, AdminGuard],
    data: {
      header: {
        title: 'Operations',
        icon: 'monitoring',
        iconTone: 'slate',
        subtitle: 'Platform telemetry and performance tooling',
        allowExpand: true,
        expandLabel: 'Operations Snapshot',
        insights: [
          {
            icon: 'compare_arrows',
            value: 'Broker Analysis',
            label: 'Compare rabbitmq and kafka behavior',
          },
          {
            icon: 'dashboard',
            value: 'Job Dashboards',
            label: 'Observe fleet-level execution trends',
          },
          {
            icon: 'memory',
            value: 'Node Metrics',
            label: 'Track compute pressure and throughput',
          },
        ],
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Operations', route: '/operations', icon: 'monitoring' },
        ],
      },
    },
  },
  {
    path: '**',
    redirectTo: 'landing',
  },
];
