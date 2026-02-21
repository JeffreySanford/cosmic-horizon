import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { LoginResponse } from '../features/auth/auth-api.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionStorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly tokenStorageKey = 'auth_token';
  private readonly refreshTokenStorageKey = 'auth_refresh_token';
  private readonly userStorageKey = 'auth_user';

  writeSession(loginResponse: LoginResponse): void {
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

  readSession(): LoginResponse | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const accessToken = sessionStorage.getItem(this.tokenStorageKey);
    const userRaw = sessionStorage.getItem(this.userStorageKey);
    if (!accessToken || !userRaw) {
      return null;
    }

    try {
      return {
        access_token: accessToken,
        refresh_token:
          sessionStorage.getItem(this.refreshTokenStorageKey) ?? undefined,
        token_type: 'Bearer',
        user: JSON.parse(userRaw),
      };
    } catch {
      return null;
    }
  }
}
