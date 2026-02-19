import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { LoginResponse } from '../features/auth/auth-api.service';

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
  private readonly tokenStorageKey = 'auth_token';
  private readonly refreshTokenStorageKey = 'auth_refresh_token';
  private readonly userStorageKey = 'auth_user';

  setSession(loginResponse: LoginResponse): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.setItem(this.tokenStorageKey, loginResponse.access_token);
    if (loginResponse.refresh_token) {
      sessionStorage.setItem(
        this.refreshTokenStorageKey,
        loginResponse.refresh_token,
      );
    } else {
      sessionStorage.removeItem(this.refreshTokenStorageKey);
    }
    sessionStorage.setItem(
      this.userStorageKey,
      JSON.stringify(loginResponse.user),
    );
  }

  clearSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.removeItem(this.tokenStorageKey);
    sessionStorage.removeItem(this.refreshTokenStorageKey);
    sessionStorage.removeItem(this.userStorageKey);
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return sessionStorage.getItem(this.tokenStorageKey);
  }

  getRefreshToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return sessionStorage.getItem(this.refreshTokenStorageKey);
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
    if (!this.isAuthenticated()) {
      return 'guest';
    }

    return this.getUser()?.role ?? 'guest';
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
