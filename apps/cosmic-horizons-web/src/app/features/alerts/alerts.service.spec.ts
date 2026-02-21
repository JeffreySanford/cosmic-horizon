import { TestBed } from '@angular/core/testing';
import { AlertsService } from './alerts.service';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom } from 'rxjs';
import { selectAlerts } from '../../store/features/alerts/alerts.selectors';
import * as AlertsActions from '../../store/features/alerts/alerts.actions';
import { vi } from 'vitest';

describe('AlertsService', () => {
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AlertsService, provideMockStore()],
    });

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectAlerts, ['one', 'two']);
    store.refreshState();
  });

  it('selects alerts from store', async () => {
    const service = TestBed.inject(AlertsService);
    const list = await firstValueFrom(service.alerts$);
    expect(list).toEqual(['one', 'two']);
  });

  it('dispatches initialize action on creation', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    TestBed.inject(AlertsService);
    expect(dispatchSpy).toHaveBeenCalledWith(
      AlertsActions.alertsInitialize(),
    );
  });
});
