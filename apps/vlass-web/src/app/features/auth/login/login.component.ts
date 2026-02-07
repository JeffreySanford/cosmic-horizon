import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

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

  constructor() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  onSubmit() {
    this.submitted = true;
    this.error = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;

    // TODO: Replace with actual API call to POST /auth/login
    // After successful auth, redirect to /landing
    console.log('Login attempt:', this.loginForm.value);
    this.loading = false;
    this.router.navigate(['/landing']);
  }

  signUp() {
    this.router.navigate(['/auth/register']);
  }
}
