import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { EMPTY, catchError, take } from 'rxjs';
import { BrokerDataService } from '../modules/operations/broker-comparison/services/broker-data.service';
import { AuthSessionService } from './auth-session.service';

@Injectable({
  providedIn: 'root',
})
export class AppStartupWarmupService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authSessionService = inject(AuthSessionService);
  private readonly brokerDataService = inject(BrokerDataService);

  warmUp(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Broker comparison is admin-gated; avoid startup calls for other roles.
    if (this.authSessionService.getRole() !== 'admin') {
      return;
    }

    this.brokerDataService
      .getCurrentMetrics()
      .pipe(
        take(1),
        catchError(() => EMPTY),
      )
      .subscribe();
  }
}
