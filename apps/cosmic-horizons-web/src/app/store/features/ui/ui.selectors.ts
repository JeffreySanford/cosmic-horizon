import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UiState, uiFeatureKey } from './ui.reducer';

export const selectUiState = createFeatureSelector<UiState>(uiFeatureKey);

export const selectMockModeEnabled = createSelector(
  selectUiState,
  (state) => state.mockModeEnabled,
);
