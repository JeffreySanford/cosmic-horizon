import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import * as AlertsActions from '../../store/features/alerts/alerts.actions';
import { selectAlerts } from '../../store/features/alerts/alerts.selectors';
import { AppState } from '../../store/app.state';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  readonly alerts$: Observable<string[]>;
  private readonly store = inject<Store<AppState>>(Store);

  constructor() {
    this.alerts$ = this.store.select(selectAlerts);
    this.store.dispatch(AlertsActions.alertsInitialize());
  }
}
