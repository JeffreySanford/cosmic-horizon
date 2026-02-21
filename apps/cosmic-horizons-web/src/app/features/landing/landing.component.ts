import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../services/auth-session.service';
import {
  SkyPreview,
  SkyPreviewService,
} from '../../services/sky-preview.service';
import { UserRole } from '../../services/auth-session.service';

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
export class LandingComponent implements OnInit {
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
      icon: 'dns',
      title: 'Broker Metrics',
      route: '/operations/broker-comparison',
      adminOnly: true,
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
    // operational dashboards
    {
      icon: 'settings',
      title: 'Operations',
      route: '/operations',
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
  private locationPromptHandled = false;

  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);

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
      this.clockLine = this.buildClockLine();
      this.updateBackgroundImage();
    }
  }

  get isAdmin(): boolean {
    return this.user.role === 'admin';
  }

  get visibleRouteLinks(): LandingRouteLink[] {
    return this.routeLinks.filter((link) => !link.adminOnly || this.isAdmin);
  }

  logout(): void {
    this.authSessionService.clearSession();
    this.router.navigate(['/auth/login']);
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

  onTelemetryControl(): void {
    if (this.locating) {
      return;
    }

    if (this.shouldPromptForLocation) {
      this.locationPromptHandled = true;
      this.telemetryCompact = false;
      this.locating = true;
      this.locationMessage = '';
      this.skyPreviewService.personalizeFromBrowserLocation().subscribe({
        next: (preview) => {
          if (!preview) {
            this.locationMessage = 'Failed to personalize preview. Using default.';
            return;
          }

          this.preview = preview;
          this.syncTelemetryFromPreview();
          this.locationMessage = 'Sky map personalized to your overhead location.';
          this.updateBackgroundImage();
        },
        error: () => {
          this.locationMessage = 'Error personalizing preview. Using default.';
        },
        complete: () => {
          this.locating = false;
        },
      });
      return;
    }

    this.telemetryCompact = !this.telemetryCompact;
  }

  get shouldPromptForLocation(): boolean {
    return !this.preview.personalized && !this.locationPromptHandled;
  }

  private updateBackgroundImage(): void {
    const element = document.querySelector('.landing-container') as HTMLElement;
    if (element) {
      element.style.backgroundImage = `linear-gradient(145deg, rgba(16, 23, 38, 0.54) 0%, rgba(11, 18, 33, 0.62) 45%, rgba(17, 24, 39, 0.68) 100%), 
        radial-gradient(circle at 10% 15%, rgba(255, 166, 77, 0.12) 0%, transparent 42%), 
        radial-gradient(circle at 85% 20%, rgba(0, 169, 255, 0.1) 0%, transparent 42%), 
        url('${this.preview.imageUrl}')`;
      element.style.backgroundSize = '200%, 200%, 200%, cover';
      element.style.backgroundPosition = 'center, center, center, center 38%';
    }
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
    const localTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZoneName: 'short',
    });
    const zuluTime = now.toUTCString().slice(17, 25);
    return `LCL ${localTime} | ZUL ${zuluTime}`;
  }
}
