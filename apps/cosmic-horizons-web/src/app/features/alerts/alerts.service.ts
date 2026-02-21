import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, timer, catchError, of, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly http = inject(HttpClient);
  private readonly alertsSubject = new BehaviorSubject<string[]>([]);
  readonly alerts$ = this.alertsSubject.asObservable();

  constructor() {
    // poll the backend every couple seconds for new alerts
    timer(0, 2000)
      .pipe(
        switchMap(() =>
          this.http.get<string[]>('/api/health/alerts').pipe(
            catchError(() => of([])),
          ),
        ),
      )
      .subscribe((list) => this.alertsSubject.next(list));
  }
}
