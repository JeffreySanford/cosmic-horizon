import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../auth-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authApiService = inject(AuthApiService);
  private authSessionService = inject(AuthSessionService);

  constructor() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
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
}
