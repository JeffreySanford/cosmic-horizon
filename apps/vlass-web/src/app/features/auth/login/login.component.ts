import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../auth-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';
import { SkyPreview, SkyPreviewService } from '../../../services/sky-preview.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  preview: SkyPreview;
  locating = false;
  locationMessage = '';
  localTime = '--:--:--';
  zuluTime = '--:--:--';
  locationLabel = '';
  latLonLabel = 'Lat --.---- | Lon --.----';
  showTelemetryOverlay = false;
  private clockIntervalId: ReturnType<typeof setInterval> | null = null;

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private authApiService = inject(AuthApiService);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);

  constructor() {
    this.preview = this.skyPreviewService.getInitialPreview();
    this.syncTelemetryFromPreview();
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
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

  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;

    const email = this.loginForm.value.email as string;
    const password = this.loginForm.value.password as string;

    this.authApiService.login({ email, password }).subscribe({
      next: (response) => {
        this.authSessionService.setSession(response);

        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/landing';
        this.loading = false;
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.error =
          error.error?.message || 'Login failed. Check your credentials and try again.';
      },
    });
  }

  signUp(): void {
    this.router.navigate(['/auth/register']);
  }

  async personalizePreview(): Promise<void> {
    this.locating = true;
    this.locationMessage = '';

    try {
      const preview = await this.skyPreviewService.personalizeFromBrowserLocation();
      if (preview) {
        this.preview = preview;
        this.syncTelemetryFromPreview();
        this.locationMessage = `Preview personalized for region ${preview.geohash.toUpperCase()}.`;
      } else {
        this.locationMessage = 'Location services are unavailable in this browser.';
      }
    } catch {
      this.locationMessage = 'Location permission denied. Continuing with default preview.';
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
