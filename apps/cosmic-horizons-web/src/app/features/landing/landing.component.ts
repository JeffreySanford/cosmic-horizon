import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, inject, NgZone, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { finalize, startWith } from 'rxjs/operators';
import { AuthSessionService } from '../../services/auth-session.service';
import { SkyPreview, SkyPreviewService } from '../../services/sky-preview.service';
import { UserRole } from '../../services/auth-session.service';
import { AuthApiService } from '../auth/auth-api.service';
import { AppLoggerService } from '../../services/app-logger.service';

interface LandingPillar {
  icon: string;
  title: string;
  route: string;
}

interface LandingRouteLink {
  icon: string;
  title: string;
  route: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
  standalone: false,
})
export class LandingComponent implements OnInit, OnDestroy {
  user = {
    name: 'User',
    username: '',
    email: 'user@example.com',
    role: 'guest' as UserRole,
  };
  pillars: LandingPillar[] = [
    {
      icon: 'travel_explore',
      title: 'Viewer, Permalinks, and Snapshots',
      route: '/view',
    },
    {
      icon: 'auto_graph',
      title: 'Scientific Ephemeris & Target Search',
      route: '/ephem',
    },
    {
      icon: 'menu_book',
      title: 'Community Research Notebook',
      route: '/posts',
    },
    {
      icon: 'hub',
      title: 'Array Telemetry Network',
      route: '/array-telemetry',
    },
  ];
  routeLinks: LandingRouteLink[] = [
    {
      icon: 'workspaces',
      title: 'Job Console',
      route: '/jobs',
    },
    {
      icon: 'description',
      title: 'Project Documentation',
      route: '/docs',
    },
    {
      icon: 'person',
      title: 'My Profile',
      route: '/profile',
    },
    {
      icon: 'gavel',
      title: 'Moderation Console',
      route: '/moderation',
      adminOnly: true,
    },
    {
      icon: 'list_alt',
      title: 'System Logs',
      route: '/logs',
      adminOnly: true,
    },
  ];
  preview: SkyPreview;
  locating = false;
  locationMessage = '';
  locationLabel = 'REG ---- | SRC default';
  latLonLabel = 'LAT --.---- | LON --.----';
  showTelemetryOverlay = false;
  telemetryCompact = true;
  clockLine = '';

  private clockSubscription?: Subscription;

  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);
  private authApiService = inject(AuthApiService);
  private readonly logger = inject(AppLoggerService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    this.showTelemetryOverlay = isPlatformBrowser(this.platformId);
    this.preview = this.skyPreviewService.getInitialPreview();
    this.syncTelemetryFromPreview();

    const sessionUser = this.authSessionService.getUser();
    if (sessionUser) {
      this.user = {
        name: sessionUser.display_name || sessionUser.username,
        username: sessionUser.username,
        email: sessionUser.email || 'user@example.com',
        role: sessionUser.role,
      };
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.ngZone.runOutsideAngular(() => {
        this.clockSubscription = interval(1000).pipe(
          startWith(0),
        ).subscribe(() => {
          this.clockLine = this.buildClockLine();
          this.cdr.detectChanges();
        });
      });
    }
  }

  ngOnDestroy(): void {
    this.clockSubscription?.unsubscribe();
  }

  get isAdmin(): boolean {
    return this.user.role === 'admin';
  }

  get visibleRouteLinks(): LandingRouteLink[] {
    return this.routeLinks.filter((link) => !link.adminOnly || this.isAdmin);
  }

  logout(): void {
    this.logger.info('auth', 'logout_requested', {
      current_role: this.user.role,
    });

    this.authApiService
      .logout(this.authSessionService.getRefreshToken() ?? undefined)
      .pipe(
        finalize(() => {
          this.authSessionService.clearSession();
          this.router.navigate(['/auth/login']);
        }),
      )
      .subscribe({
        next: () => {
          this.logger.info('auth', 'logout_success');
        },
        error: (error: { status?: number }) => {
          this.logger.info('auth', 'logout_failed', {
            status_code: error.status ?? null,
          });
        },
      });
  }

  openPillar(pillar: LandingPillar): void {
    this.router.navigateByUrl(pillar.route);
  }

  openRouteLink(link: LandingRouteLink): void {
    this.router.navigateByUrl(link.route);
  }

  openLogs(): void {
    this.router.navigateByUrl('/logs');
  }

  toggleTelemetryCompact(): void {
    this.telemetryCompact = !this.telemetryCompact;
  }

  personalizePreview(): void {
    this.locating = true;
    this.locationMessage = '';

    this.skyPreviewService.personalizeFromBrowserLocation().subscribe({
      next: (preview) => {
        if (preview) {
          this.preview = preview;
          this.syncTelemetryFromPreview();
          this.locationMessage = `Sky preview personalized for region ${preview.geohash.toUpperCase()}.`;
        } else {
          this.locationMessage = 'Location services are unavailable in this environment.';
        }
      },
      error: () => {
        this.locating = false;
        this.locationMessage = 'Location permission was denied. Using default preview.';
      },
      complete: () => {
        this.locating = false;
      },
    });
  }

  private syncTelemetryFromPreview(): void {
    this.locationLabel = `REG ${this.preview.geohash.toUpperCase()} | SRC ${this.preview.source}`;

    if (this.preview.latitude === null || this.preview.longitude === null) {
      this.latLonLabel = 'LAT --.---- | LON --.----';
      return;
    }

    this.latLonLabel = `LAT ${this.preview.latitude.toFixed(4)} | LON ${this.preview.longitude.toFixed(4)}`;
  }

  private buildClockLine(): string {
    const now = new Date();
    const localTime = now.toLocaleTimeString('en-US', { hour12: false, timeZoneName: 'short' });
    const zuluTime = now.toUTCString().slice(17, 25);
    return `LCL ${localTime} | ZUL ${zuluTime}`;
  }

}
