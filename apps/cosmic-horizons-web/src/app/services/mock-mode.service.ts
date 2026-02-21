import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import * as UiActions from '../store/features/ui/ui.actions';
import { selectMockModeEnabled } from '../store/features/ui/ui.selectors';
import { AppState } from '../store/app.state';

@Injectable({ providedIn: 'root' })
export class MockModeService {
  readonly mock$: Observable<boolean>;
  private latestMock = true;
  private readonly store = inject<Store<AppState>>(Store);

  constructor() {
    this.mock$ = this.store.select(selectMockModeEnabled);
    this.mock$.subscribe((enabled) => {
      this.latestMock = enabled;
    });
  }

  enable(): void {
    this.store.dispatch(UiActions.mockModeSetRequested({ enabled: true }));
  }
  disable(): void {
    this.store.dispatch(UiActions.mockModeSetRequested({ enabled: false }));
  }
  toggle(): void {
    this.store.dispatch(
      UiActions.mockModeSetRequested({ enabled: !this.latestMock }),
    );
  }
  get isMock(): boolean {
    return this.latestMock;
  }
}
