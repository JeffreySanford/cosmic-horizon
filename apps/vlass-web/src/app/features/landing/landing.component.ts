import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
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
export class LandingComponent implements OnInit, OnDestroy {
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
  localTime = '--:--:--';
  zuluTime = '--:--:--';
  locationLabel = '';
  latLonLabel = 'Lat --.---- | Lon --.----';
  showTelemetryOverlay = false;
  private clockIntervalId: ReturnType<typeof setInterval> | null = null;

  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);

  constructor() {
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

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.showTelemetryOverlay = true;
    this.updateClock();
    this.clockIntervalId = setInterval(() => {
      this.updateClock();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
      this.clockIntervalId = null;
    }
  }

  logout(): void {
    this.authSessionService.clearSession();
    this.router.navigate(['/auth/login']);
  }

  async personalizePreview(): Promise<void> {
    this.locating = true;
    this.locationMessage = '';

    try {
      const preview = await this.skyPreviewService.personalizeFromBrowserLocation();
      if (preview) {
        this.preview = preview;
        this.syncTelemetryFromPreview();
        this.locationMessage = `Sky preview personalized for region ${preview.geohash.toUpperCase()}.`;
      } else {
        this.locationMessage = 'Location services are unavailable in this environment.';
      }
    } catch {
      this.locationMessage = 'Location permission was denied. Using default preview.';
    } finally {
      this.locating = false;
    }
  }

  private updateClock(): void {
    const now = new Date();
    this.localTime = now.toLocaleTimeString('en-US', { hour12: false });
    this.zuluTime = now.toUTCString().slice(17, 25);
  }

  private syncTelemetryFromPreview(): void {
    this.locationLabel = `Region ${this.preview.geohash.toUpperCase()} (${this.preview.source})`;

    if (this.preview.latitude === null || this.preview.longitude === null) {
      this.latLonLabel = 'Lat --.---- | Lon --.----';
      return;
    }

    this.latLonLabel = `Lat ${this.preview.latitude.toFixed(4)} | Lon ${this.preview.longitude.toFixed(4)}`;
  }

}
