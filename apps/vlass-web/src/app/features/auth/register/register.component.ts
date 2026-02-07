import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, interval } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { SkyPreview, SkyPreviewService } from '../../../services/sky-preview.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
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
  locationLabel = '';
  latLonLabel = 'Lat --.---- | Lon --.----';
  showTelemetryOverlay = false;
  readonly clockLine$: Observable<string> = interval(1000).pipe(
    startWith(0),
    map(() => this.buildClockLine()),
  );

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private skyPreviewService = inject(SkyPreviewService);

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
