import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, inject, NgZone, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { AuthApiService } from '../auth-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';
import { SkyPreview, SkyPreviewService } from '../../../services/sky-preview.service';
import { AppLoggerService } from '../../../services/app-logger.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false,
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
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
  clockLine = '';

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private authApiService = inject(AuthApiService);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);
  private readonly logger = inject(AppLoggerService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);

  private clockSubscription?: Subscription;

  constructor() {
    this.showTelemetryOverlay = isPlatformBrowser(this.platformId);
    this.preview = this.skyPreviewService.getInitialPreview();
    this.syncTelemetryFromPreview();
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required]],
      password: ['', Validators.required],
    });
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

  get f() {
    return this.loginForm.controls;
  }

  get backgroundStyle(): SafeStyle {
    const imageUrl = this.preview?.imageUrl || '/previews/region-default.png';
    return this.sanitizer.bypassSecurityTrustStyle(`--sky-preview-url: url(${imageUrl})`);
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    this.logger.info('auth', 'login_submit', {
      form_valid: this.loginForm.valid,
    });

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;

    const email = this.loginForm.value.email as string;
    const password = this.loginForm.value.password as string;

    this.authApiService.login({ email, password }).subscribe({
      next: (response) => {
        this.authSessionService.setSession(response);
        this.logger.info('auth', 'login_success', {
          user_id: response.user.id,
          user_role: response.user.role,
        });

        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/landing';
        this.loading = false;
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.error = this.errorFromHttp(error);
        this.logger.info('auth', 'login_failed', {
          status_code: error.status,
        });
      },
    });
  }

  signUp(): void {
    this.router.navigate(['/auth/register']);
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
          this.locationMessage = `Preview personalized for region ${preview.geohash.toUpperCase()}.`;
        } else {
          this.locationMessage = 'Location services are unavailable in this browser.';
        }
      },
      error: () => {
        this.locating = false;
        this.locationMessage = 'Location permission denied. Continuing with default preview.';
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

    if (error.status === 401) {
      return 'Invalid credentials. Verify your email and password.';
    }

    if (error.status === 404) {
      return 'API route not found on localhost:3000. Another service may be bound to port 3000.';
    }

    if (error.status === 0) {
      return 'API is unavailable. Confirm cosmic-horizons-api is running on port 3000.';
    }

    return 'Login failed. Check your credentials and try again.';
  }
}
