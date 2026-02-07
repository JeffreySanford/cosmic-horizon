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
    },
    {
      icon: 'travel_explore',
      title: 'Viewer, Permalinks, and Snapshots',
    },
    {
      icon: 'menu_book',
      title: 'Community Research Notebook',
    },
  ];
  preview: SkyPreview;
  locating = false;
  locationMessage = '';
  locationLabel = '';
  latLonLabel = 'Lat --.---- | Lon --.----';
  showTelemetryOverlay = false;
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
    this.locationLabel = `Region ${this.preview.geohash.toUpperCase()} (${this.preview.source})`;

    if (this.preview.latitude === null || this.preview.longitude === null) {
      this.latLonLabel = 'Lat --.---- | Lon --.----';
      return;
    }

    this.latLonLabel = `Lat ${this.preview.latitude.toFixed(4)} | Lon ${this.preview.longitude.toFixed(4)}`;
  }

  private buildClockLine(): string {
    const now = new Date();
    const localTime = now.toLocaleTimeString('en-US', { hour12: false });
    const zuluTime = now.toUTCString().slice(17, 25);
    return `Local ${localTime} | Zulu ${zuluTime}`;
  }

}
