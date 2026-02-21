import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { AuthApiService } from '../../../features/auth/auth-api.service';
import { AuthSessionStorageService } from '../../../services/auth-session-storage.service';
import * as AuthActions from './auth.actions';
import { selectRefreshToken } from './auth.selectors';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly authApi = inject(AuthApiService);
  private readonly storage = inject(AuthSessionStorageService);
  private readonly router = inject(Router);
  private readonly store = inject(Store);

  hydrate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.authHydrateRequested),
      map(() => AuthActions.authHydrated({ session: this.storage.readSession() })),
    ),
  );

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.authLoginRequested),
      switchMap(({ request }) =>
        this.authApi.login(request).pipe(
          map((response) => AuthActions.authLoginSucceeded({ response })),
          catchError((error: { error?: { message?: string } }) =>
            of(AuthActions.authLoginFailed({ error: error?.error?.message ?? 'Login failed' })),
          ),
        ),
      ),
    ),
  );

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.authRegisterRequested),
      switchMap(({ request }) =>
        this.authApi.register(request).pipe(
          map((response) => AuthActions.authRegisterSucceeded({ response })),
          catchError((error: { error?: { message?: string } }) =>
            of(AuthActions.authRegisterFailed({ error: error?.error?.message ?? 'Registration failed' })),
          ),
        ),
      ),
    ),
  );

  persistSession$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.authLoginSucceeded, AuthActions.authRegisterSucceeded, AuthActions.authSessionUpdated),
        tap(({ response }) => this.storage.writeSession(response)),
      ),
    { dispatch: false },
  );

  clearSession$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.authLogoutCompleted, AuthActions.authSessionCleared),
        tap(() => this.storage.clearSession()),
      ),
    { dispatch: false },
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.authLogoutRequested),
      withLatestFrom(this.store.select(selectRefreshToken)),
      switchMap(([, refreshToken]) =>
        this.authApi.logout(refreshToken ?? undefined).pipe(
          map(() => AuthActions.authLogoutCompleted()),
          catchError(() => of(AuthActions.authLogoutCompleted())),
        ),
      ),
    ),
  );

  redirectOnLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.authLogoutCompleted),
        tap(() => void this.router.navigateByUrl('/auth/login')),
      ),
    { dispatch: false },
  );

}
