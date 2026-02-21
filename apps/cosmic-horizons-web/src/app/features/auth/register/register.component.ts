import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from '../auth-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';
import {
  SkyPreview,
  SkyPreviewService,
} from '../../../services/sky-preview.service';
import { AppLoggerService } from '../../../services/app-logger.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: false,
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  preview: SkyPreview;

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authApiService = inject(AuthApiService);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);
  private readonly logger = inject(AppLoggerService);

  constructor() {
    this.preview = this.skyPreviewService.getInitialPreview();
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
    this.authApiService
      .register({
        username,
        email,
        password,
        display_name: username,
      })
      .subscribe({
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
      return 'API is unavailable. Confirm cosmic-horizons-api is running on port 3000.';
    }

    return 'Registration failed. Please retry.';
  }
}
