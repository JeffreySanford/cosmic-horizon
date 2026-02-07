import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    // TODO: Replace with actual auth service check
    // This should verify if user session exists or token is valid
    const isAuthenticated = this.checkAuthentication();

    if (isAuthenticated) {
      return true;
    }

    // Redirect to login if not authenticated
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  private checkAuthentication(): boolean {
    // TODO: Implement actual authentication check
    // For now, assume authenticated if we have a session
    return !!sessionStorage.getItem('auth_token');
  }
}
