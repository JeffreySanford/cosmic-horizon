import { createReducer, on } from '@ngrx/store';
import * as UiActions from './ui.actions';

export const uiFeatureKey = 'ui';

export interface UiState {
  mockModeEnabled: boolean;
}

export const initialUiState: UiState = {
  mockModeEnabled: true,
};

export const uiReducer = createReducer(
  initialUiState,
  on(
    UiActions.mockModeHydrated,
    UiActions.mockModeSetRequested,
    (state, { enabled }) => ({
      ...state,
      mockModeEnabled: enabled,
    }),
  ),
);
