export interface AppHeaderLink {
  label: string;
  route: string;
  icon: string;
}

export interface AppHeaderBreadcrumb {
  label: string;
  route?: string;
  icon?: string;
}

export type AppHeaderIconTone =
  | 'aurora'
  | 'solar'
  | 'teal'
  | 'violet'
  | 'slate';

export interface AppHeaderMenuItem {
  label: string;
  icon: string;
  route?: string;
  action?: string;
}

export interface AppHeaderInsight {
  icon: string;
  value: string;
  label: string;
}

export interface AppHeaderConfig {
  title: string;
  icon: string;
  iconTone: AppHeaderIconTone;
  subtitle?: string;
  breadcrumbs: AppHeaderBreadcrumb[];
  homeLink: AppHeaderLink;
  parentLink?: AppHeaderLink;
  showUserMenu: boolean;
  userMenuItems: AppHeaderMenuItem[];
  allowExpand: boolean;
  expandedByDefault: boolean;
  expandLabel: string;
  insights: AppHeaderInsight[];
  showQuickStats: boolean;
}

export const DEFAULT_APP_HEADER_CONFIG: AppHeaderConfig = {
  title: 'Cosmic Horizons',
  icon: 'travel_explore',
  iconTone: 'aurora',
  subtitle: 'AI Control Plane',
  breadcrumbs: [
    {
      label: 'Home',
      route: '/landing',
      icon: 'home',
    },
  ],
  homeLink: {
    label: 'Landing',
    route: '/landing',
    icon: 'home',
  },
  showUserMenu: true,
  userMenuItems: [
    {
      label: 'Profile',
      route: '/profile',
      icon: 'account_circle',
    },
    {
      label: 'Log Out',
      icon: 'logout',
      action: 'logout',
    },
  ],
  allowExpand: false,
  expandedByDefault: false,
  expandLabel: 'Page details',
  insights: [],
  showQuickStats: true,
};
