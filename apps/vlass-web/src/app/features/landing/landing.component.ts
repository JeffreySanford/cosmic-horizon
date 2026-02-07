import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, interval } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AuthSessionService } from '../../services/auth-session.service';
import { SkyPreview, SkyPreviewService } from '../../services/sky-preview.service';

interface LandingPillar {
  icon: string;
  title: string;
  route: string;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class LandingComponent {
  user = {
    name: 'User',
    email: 'user@example.com',
  };
  pillars: LandingPillar[] = [
    {
      icon: 'speed',
      title: 'Instant SSR First Paint',
      route: '/landing',
    },
    {
      icon: 'travel_explore',
      title: 'Viewer, Permalinks, and Snapshots',
      route: '/view',
    },
    {
      icon: 'menu_book',
      title: 'Community Research Notebook',
      route: '/landing',
    },
  ];
  preview: SkyPreview;
  locating = false;
  locationMessage = '';
  locationLabel = 'REG ---- | SRC default';
  latLonLabel = 'LAT --.---- | LON --.----';
  showTelemetryOverlay = false;
  telemetryCompact = true;
  readonly clockLine$: Observable<string> = interval(1000).pipe(
    startWith(0),
    map(() => this.buildClockLine()),
  );

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
        email: sessionUser.email || 'user@example.com',
      };
    }
  }

  logout(): void {
    this.authSessionService.clearSession();
    this.router.navigate(['/auth/login']);
  }

  openPillar(pillar: LandingPillar): void {
    this.router.navigateByUrl(pillar.route);
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
