import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, tap } from 'rxjs/operators';
import * as UiActions from './ui.actions';

@Injectable()
export class UiEffects {
  private readonly actions$ = inject(Actions);

  hydrateMockMode$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UiActions.mockModeHydrateRequested),
      map(() => {
        if (typeof window === 'undefined') {
          return UiActions.mockModeHydrated({ enabled: true });
        }

        const raw = window.sessionStorage.getItem('mock_mode_enabled');
        return UiActions.mockModeHydrated({
          enabled: raw === null ? true : raw !== 'false',
        });
      }),
    ),
  );

  persistMockMode$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UiActions.mockModeSetRequested),
        tap(({ enabled }) => {
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('mock_mode_enabled', String(enabled));
          }
        }),
      ),
    { dispatch: false },
  );
}
