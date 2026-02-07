import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class LandingComponent {
  user = {
    name: 'User',
    email: 'user@example.com',
  };
  features = [
    {
      icon: 'dashboard_customize',
      title: 'Structured Authoring',
      description: 'Compose and revise technical content with a clean workflow.',
    },
    {
      icon: 'auto_graph',
      title: 'Quality Signals',
      description: 'Track readiness with fast feedback from tests and checks.',
    },
    {
      icon: 'groups_3',
      title: 'Team Collaboration',
      description: 'Coordinate editing and publishing steps across the team.',
    },
    {
      icon: 'bolt',
      title: 'Fast Delivery',
      description: 'Ship improvements quickly with reproducible Nx pipelines.',
    },
  ];

  private router = inject(Router);
  private authSessionService = inject(AuthSessionService);

  constructor() {
    const sessionUser = this.authSessionService.getUser();
    if (sessionUser) {
      this.user = {
        name: sessionUser.display_name || sessionUser.username,
        email: sessionUser.email || 'user@example.com',
      };
    }
  }

  logout(): void {
    this.authSessionService.clearSession();
    this.router.navigate(['/auth/login']);
  }
}
