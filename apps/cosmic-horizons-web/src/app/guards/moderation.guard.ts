import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthApiService } from '../features/auth/auth-api.service';
import { AuthSessionService } from '../services/auth-session.service';

@Injectable({
  providedIn: 'root',
})
export class ModerationGuard implements CanActivate {
  private readonly router = inject(Router);
  private readonly authApiService = inject(AuthApiService);
  private readonly authSessionService = inject(AuthSessionService);

  canActivate() {
    if (this.authSessionService.getRole() === 'guest') {
      this.router.navigate(['/auth/login']);
      return false;
    }

    return this.authApiService.getMe().pipe(
      map((response) => {
        const role = response.user.role;
        if (role === 'admin' || role === 'moderator') {
          return true;
        }

        this.router.navigate(['/landing']);
        return false;
      }),
      catchError(() => {
        this.router.navigate(['/auth/login']);
        return of(false);
      }),
    );
  }
}
