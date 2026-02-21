import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AlertsService } from './alerts.service';

@Component({
  selector: 'app-alerts',
  standalone: false,
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.scss'],
})
export class AlertsComponent {
  private readonly alertsSvc = inject(AlertsService);
  readonly alerts$: Observable<string[]> = this.alertsSvc.alerts$;
}
