import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

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

  logout() {
    // TODO: Call logout API
    this.router.navigate(['/auth/login']);
  }
}
