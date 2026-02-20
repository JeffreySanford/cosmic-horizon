import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Simple in-memory correlation id store for the web application.
 *
 * When the API responds with a header, we capture it here so that
 * subsequent outgoing requests may attach the same ID.  The logger
 * interceptor also reads from this service when writing logs.
 */
@Injectable({ providedIn: 'root' })
export class CorrelationService {
  private readonly cid$ = new BehaviorSubject<string | null>(null);

  setCorrelationId(id: string): void {
    this.cid$.next(id);
  }

  getCorrelationId(): string | null {
    return this.cid$.value;
  }

  // exposed for consumers who want to subscribe to changes
  correlationId$() {
    return this.cid$.asObservable();
  }
}
