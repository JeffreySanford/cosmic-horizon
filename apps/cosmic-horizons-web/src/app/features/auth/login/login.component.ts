import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../auth-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';
import {
  SkyPreview,
  SkyPreviewService,
} from '../../../services/sky-preview.service';
import { AppLoggerService } from '../../../services/app-logger.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false,
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  preview: SkyPreview;

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private authApiService = inject(AuthApiService);
  private authSessionService = inject(AuthSessionService);
  private skyPreviewService = inject(SkyPreviewService);
  private readonly logger = inject(AppLoggerService);

  constructor() {
    this.preview = this.skyPreviewService.getInitialPreview();
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    if (
      isPlatformBrowser(this.platformId) &&
      this.authSessionService.isAuthenticated()
    ) {
      const returnUrl =
        this.route.snapshot.queryParamMap.get('returnUrl') || '/landing';
      void this.router.navigateByUrl(returnUrl);
      return;
    }

  }

  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    this.logger.info('auth', 'login_submit', {
      form_valid: this.loginForm.valid,
    });

    if (this.loginForm.invalid) {
      this.logger.warn('auth', 'login_form_invalid', {
        email_invalid: this.f['email'].invalid,
        password_invalid: this.f['password'].invalid,
      });
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

        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') || '/landing';
        this.loading = false;
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.error = this.errorFromHttp(error);
        this.logger.info('auth', 'login_failed', {
          status_code: error.status,
          error_message: error.error?.message || error.statusText,
        });
      },
    });
  }

  signUp(): void {
    this.router.navigate(['/auth/register']);
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
