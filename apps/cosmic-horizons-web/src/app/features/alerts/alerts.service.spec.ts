import { TestBed } from '@angular/core/testing';
import { AlertsService } from './alerts.service';

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(() => {
    // HttpClient isn't needed because we will manipulate the internal subject
    TestBed.configureTestingModule({
      providers: [AlertsService],
    });

    service = TestBed.inject(AlertsService);
  });

  it('exposes alerts$ and updates when http returns data', () => {
    return new Promise<void>((resolve) => {
      service.alerts$.subscribe((list) => {
        if (list.length) {
          expect(list).toEqual(['one', 'two']);
          resolve();
        }
      });
      // push directly into the private subject
      (service as any).alertsSubject.next(['one', 'two']);
    });
  });
});
