import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, interval } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AuthApiService } from '../auth-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';
import { SkyPreview, SkyPreviewService } from '../../../services/sky-preview.service';
import { AppLoggerService } from '../../../services/app-logger.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';
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

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private authApiService = inject(AuthApiService);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);
  private readonly logger = inject(AppLoggerService);

  constructor() {
    this.showTelemetryOverlay = isPlatformBrowser(this.platformId);
    this.preview = this.skyPreviewService.getInitialPreview();
    this.syncTelemetryFromPreview();
    this.registerForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    });
  }

  get f() {
    return this.registerForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    this.logger.info('auth', 'register_submit', {
      form_valid: this.registerForm.valid,
    });

    if (this.registerForm.invalid) {
      if (
        this.registerForm.value.password !==
        this.registerForm.value.confirmPassword
      ) {
        this.error = 'Passwords do not match';
      }
      return;
    }

    if (
      this.registerForm.value.password !==
      this.registerForm.value.confirmPassword
    ) {
      this.error = 'Passwords do not match';
      return;
    }

    const username = this.registerForm.value.username as string;
    const email = this.registerForm.value.email as string;
    const password = this.registerForm.value.password as string;

    this.loading = true;
    this.authApiService.register({
      username,
      email,
      password,
      display_name: username,
    }).subscribe({
      next: (response) => {
        this.authSessionService.setSession(response);
        this.logger.info('auth', 'register_success', {
          user_id: response.user.id,
          user_role: response.user.role,
        });
        this.loading = false;
        this.router.navigate(['/landing']);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.error = this.errorFromHttp(error);
        this.logger.info('auth', 'register_failed', {
          status_code: error.status,
        });
      },
    });
  }

  login(): void {
    this.router.navigate(['/auth/login']);
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
          this.locationMessage = `Background personalized for region ${preview.geohash.toUpperCase()}.`;
        } else {
          this.locationMessage = 'Location services are unavailable in this browser.';
        }
      },
      error: () => {
        this.locating = false;
        this.locationMessage = 'Location permission denied. Using default background.';
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

  private errorFromHttp(error: HttpErrorResponse): string {
    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    if (error.status === 409) {
      return 'Username or email already exists.';
    }

    if (error.status === 404) {
      return 'API route not found on localhost:3000. Another service may be bound to port 3000.';
    }

    if (error.status === 0) {
      return 'API is unavailable. Confirm vlass-api is running on port 3000.';
    }

    return 'Registration failed. Please retry.';
  }
}
