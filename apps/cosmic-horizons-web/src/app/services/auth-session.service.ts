import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  selectAccessToken,
  selectAuthRole,
  selectAuthUser,
  selectRefreshToken,
} from '../store/features/auth/auth.selectors';
import * as AuthActions from '../store/features/auth/auth.actions';
import { LoginResponse } from '../features/auth/auth-api.service';
import { AppState } from '../store/app.state';

export type UserRole = 'guest' | 'user' | 'admin' | 'moderator';

export interface SessionUser {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  role: Exclude<UserRole, 'guest'>;
  created_at: string;
}

interface JwtPayload {
  exp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly store = inject<Store<AppState>>(Store);
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: SessionUser | null = null;
  private role: UserRole = 'guest';
  private readonly tokenStorageKey = 'auth_token';
  private readonly refreshTokenStorageKey = 'auth_refresh_token';
  private readonly userStorageKey = 'auth_user';

  constructor() {
    this.store.select(selectAccessToken).subscribe((token) => {
      this.accessToken = token;
    });
    this.store.select(selectRefreshToken).subscribe((token) => {
      this.refreshToken = token;
    });
    this.store.select(selectAuthUser).subscribe((user) => {
      this.user = user;
    });
    this.store.select(selectAuthRole).subscribe((role) => {
      this.role = role;
    });
  }

  setSession(loginResponse: LoginResponse): void {
    this.store.dispatch(
      AuthActions.authSessionUpdated({ response: loginResponse }),
    );
  }

  clearSession(): void {
    this.store.dispatch(AuthActions.authSessionCleared());
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return this.accessToken ?? sessionStorage.getItem(this.tokenStorageKey);
  }

  getRefreshToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return (
      this.refreshToken ?? sessionStorage.getItem(this.refreshTokenStorageKey)
    );
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    const payload = this.parseJwtPayload(token);
    if (!payload) {
      return false;
    }

    if (payload.exp === undefined) {
      return true;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowInSeconds;
  }

  getUser(): SessionUser | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    if (this.user) {
      return this.user;
    }

    const raw = sessionStorage.getItem(this.userStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }

  getRole(): UserRole {
    return this.isAuthenticated() ? this.role : 'guest';
  }

  private parseJwtPayload(token: string): JwtPayload | null {
    const tokenParts = token.split('.');
    if (tokenParts.length < 2) {
      return null;
    }

    const payloadPart = tokenParts[1];
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

    try {
      const decoded = atob(padded);
      return JSON.parse(decoded) as JwtPayload;
    } catch {
      return null;
    }
  }
}
