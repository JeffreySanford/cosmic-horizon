import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SkyPreview, SkyPreviewService } from '../../../services/sky-preview.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm: FormGroup;
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
  private platformId = inject(PLATFORM_ID);
  private skyPreviewService = inject(SkyPreviewService);

  constructor() {
    this.preview = this.skyPreviewService.getInitialPreview();
    this.syncTelemetryFromPreview();
    this.registerForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
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
    return this.registerForm.controls;
  }

  onSubmit() {
    this.submitted = true;
    this.error = '';

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

    this.loading = true;

    // TODO: Replace with actual API call to POST /auth/register
    // After successful auth, redirect to /landing
    console.log('Register attempt:', {
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
    });
    this.loading = false;
    this.router.navigate(['/landing']);
  }

  login() {
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
        this.locationMessage = `Background personalized for region ${preview.geohash.toUpperCase()}.`;
      } else {
        this.locationMessage = 'Location services are unavailable in this browser.';
      }
    } catch {
      this.locationMessage = 'Location permission denied. Using default background.';
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
