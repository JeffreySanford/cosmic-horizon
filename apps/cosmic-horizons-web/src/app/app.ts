import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MessagingService } from './services/messaging.service';
import type { EventBase } from '@cosmic-horizons/event-models';
import {
  AppHeaderConfig,
  AppHeaderLink,
  DEFAULT_APP_HEADER_CONFIG,
} from './shared/layout/app-header/app-header.types';
import { filter, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthApiService } from './features/auth/auth-api.service';
import { AuthSessionService } from './services/auth-session.service';
import { AppHeaderControlService } from './shared/layout/app-header/app-header-control.service';

interface AppHeaderRouteData extends Partial<AppHeaderConfig> {
  header?: Partial<AppHeaderConfig>;
  hideAppHeader?: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: false,
})
export class App implements OnInit {
  protected title = 'cosmic-horizons-web';
  protected headerConfig: AppHeaderConfig = DEFAULT_APP_HEADER_CONFIG;
  protected showHeader = true;
  protected headerExpanded = false;
  protected routeVisualClass = 'route-neutral';
  private readonly messaging = inject(MessagingService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly authSession = inject(AuthSessionService);
  private readonly headerControl = inject(AppHeaderControlService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.headerExpanded = false;
        this.updateHeaderConfigFromRoute();
      });

    this.headerControl.expanded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((expanded) => {
        this.headerExpanded = expanded;
      });

    // Global toast for notification events (e.g. community.discovery.created)
    this.messaging.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: EventBase) => {
        try {
          const type = payload.event_type ?? '';
          if (type === 'community.discovery.created') {
            const pd = payload.payload as {
              discovery_id?: string;
              title?: string;
              author?: string;
            };
            const title = pd?.title ?? 'New discovery';
            this.snackBar.open(`Community: ${title}`, 'View', {
              duration: 5000,
            });
          }
        } catch {
          // swallow UI notification errors
        }
      });
  }

  protected handleHeaderMenuAction(action: string): void {
    if (action !== 'logout') {
      return;
    }

    const refreshToken = this.authSession.getRefreshToken() ?? undefined;
    if (!refreshToken) {
      this.completeLogout();
      return;
    }

    this.authApi.logout(refreshToken).subscribe({
      next: () => this.completeLogout(),
      error: () => this.completeLogout(),
    });
  }

  protected onHeaderExpandedChange(expanded: boolean): void {
    this.headerExpanded = expanded;
  }

  private completeLogout(): void {
    this.authSession.clearSession();
    void this.router.navigateByUrl('/auth/login');
  }

  private updateHeaderConfigFromRoute(): void {
    const activeSnapshot = this.getActiveRouteSnapshot();
    const pathFromRoot = activeSnapshot.pathFromRoot;
    const inheritedData = pathFromRoot.map(
      (snapshot) => snapshot.data as AppHeaderRouteData,
    );
    const inheritedConfig = pathFromRoot.reduce((current, snapshot) => {
      const data = snapshot.data as AppHeaderRouteData;
      const routeHeader = data.header ?? {};
      return {
        ...current,
        ...routeHeader,
      };
    }, {} as Partial<AppHeaderConfig>);
    const inheritedHideHeader = inheritedData
      .map((data) => data.hideAppHeader)
      .filter((value): value is boolean => value !== undefined)
      .at(-1);
    this.showHeader = !(inheritedHideHeader ?? false);
    this.routeVisualClass = this.resolveRouteVisualClass(activeSnapshot);

    const defaultParentLink = this.buildDefaultParentLink(activeSnapshot);

    this.headerConfig = {
      ...DEFAULT_APP_HEADER_CONFIG,
      ...inheritedConfig,
      breadcrumbs:
        inheritedConfig.breadcrumbs ?? DEFAULT_APP_HEADER_CONFIG.breadcrumbs,
      homeLink: inheritedConfig.homeLink ?? DEFAULT_APP_HEADER_CONFIG.homeLink,
      parentLink: inheritedConfig.parentLink ?? defaultParentLink,
      showUserMenu: inheritedConfig.showUserMenu ?? true,
      userMenuItems:
        inheritedConfig.userMenuItems ??
        DEFAULT_APP_HEADER_CONFIG.userMenuItems,
    };
  }

  private getActiveRouteSnapshot(): ActivatedRouteSnapshot {
    let current = this.router.routerState.snapshot.root;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  private buildDefaultParentLink(
    activeRoute: ActivatedRouteSnapshot,
  ): AppHeaderLink | undefined {
    const segments = activeRoute.pathFromRoot
      .flatMap((snapshot) => snapshot.url.map((segment) => segment.path))
      .filter(Boolean);

    if (segments.length <= 2) {
      return undefined;
    }

    return {
      label: 'Parent',
      route: `/${segments.slice(0, -1).join('/')}`,
      icon: 'arrow_upward',
    };
  }

  private resolveRouteVisualClass(activeRoute: ActivatedRouteSnapshot): string {
    const segments = activeRoute.pathFromRoot
      .flatMap((snapshot) => snapshot.url.map((segment) => segment.path))
      .filter(Boolean);
    const root = segments[0] ?? '';

    const calmRoots = new Set([
      'operations',
      'logs',
      'alerts',
      'jobs',
      'jobs-orchestration',
      'array-telemetry',
    ]);
    const expressiveRoots = new Set([
      'landing',
      'view',
      'community',
      'posts',
      'profile',
      'docs',
      'ephem',
      'inference',
    ]);

    if (calmRoots.has(root)) {
      return 'route-calm';
    }
    if (expressiveRoots.has(root)) {
      return 'route-expressive';
    }
    return 'route-neutral';
  }
}
