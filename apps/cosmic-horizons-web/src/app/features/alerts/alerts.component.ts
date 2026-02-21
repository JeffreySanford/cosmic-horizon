import { Component } from '@angular/core';

@Component({
  selector: 'app-alerts',
  standalone: false,
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Alerts</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>No alerts to display yet.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      mat-card {
        margin: 1rem;
      }
    `,
  ],
})
export class AlertsComponent {}
