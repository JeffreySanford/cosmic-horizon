import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

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

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  constructor() {
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
}
