import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  standalone: false,
})
export class LandingComponent implements OnInit {
  user = {
    name: 'User',
    email: 'user@example.com',
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    // TODO: Load user from session/auth service
    console.log('Landing page loaded');
  }

  logout() {
    // TODO: Call logout API
    this.router.navigate(['/auth/login']);
  }
}
