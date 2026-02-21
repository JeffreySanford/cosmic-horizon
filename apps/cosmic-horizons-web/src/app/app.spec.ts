import { TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { App } from './app';
import { RouterModule } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { FooterComponent } from './shared/layout/footer/footer.component';
import { MessagingService } from './services/messaging.service';
import { AuthApiService } from './features/auth/auth-api.service';
import { AuthSessionService } from './services/auth-session.service';
import { provideMockStore } from '@ngrx/store/testing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [App, FooterComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: MessagingService,
          useValue: { notifications$: of() },
        },
        {
          provide: MatSnackBar,
          useValue: { open: () => void 0 },
        },
        {
          provide: AuthApiService,
          useValue: { logout: () => of(null) },
        },
        {
          provide: AuthSessionService,
          useValue: {
            getRefreshToken: () => null,
            clearSession: () => void 0,
          },
        },
        provideMockStore(),
      ],
    }).compileComponents();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('app-footer')).toBeTruthy();
    expect(compiled.querySelector('app-header')).toBeTruthy();
  });
});
