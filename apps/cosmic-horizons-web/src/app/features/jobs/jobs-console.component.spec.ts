// Aggressive polyfill for jsdom test environment - Angular Forms navigator.platform fix
// Must run BEFORE any Angular Forms imports
(function ensureNavigatorPlatform() {
  if (typeof navigator !== 'undefined') {
    try {
      // Check if platform is undefined or empty
      if (navigator.platform === undefined || navigator.platform === '') {
        // Try to define it
        Object.defineProperty(navigator, 'platform', {
          value: 'Linux x86_64',
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    } catch (e) {
      try {
        // Fallback: try direct assignment
        (navigator as any).platform = 'Linux x86_64';
      } catch (err) {
        console.warn('Could not define navigator.platform:', err);
      }
    }

    // Also ensure window.navigator.platform
    if (typeof window !== 'undefined' && window.navigator) {
      try {
        if (
          window.navigator.platform === undefined ||
          window.navigator.platform === ''
        ) {
          Object.defineProperty(window.navigator, 'platform', {
            value: 'Linux x86_64',
            writable: true,
            configurable: true,
          });
        }
      } catch (e) {
        try {
          (window.navigator as any).platform = 'Linux x86_64';
        } catch (err) {
          console.warn('Could not define window.navigator.platform:', err);
        }
      }
    }
  }
})();

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { JobsConsoleComponent } from './jobs-console.component';

describe('JobsConsoleComponent', () => {
  let component: JobsConsoleComponent;
  let fixture: ComponentFixture<JobsConsoleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JobsConsoleComponent],
      imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatChipsModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(JobsConsoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
