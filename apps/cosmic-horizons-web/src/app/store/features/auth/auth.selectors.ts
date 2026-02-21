import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState, authFeatureKey } from './auth.reducer';

export const selectAuthState = createFeatureSelector<AuthState>(authFeatureKey);

export const selectAuthUser = createSelector(
  selectAuthState,
  (state) => state.user,
);
export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state) => state.authenticated,
);
export const selectAuthRole = createSelector(
  selectAuthUser,
  (user) => user?.role ?? 'guest',
);
export const selectAccessToken = createSelector(
  selectAuthState,
  (state) => state.accessToken,
);
export const selectRefreshToken = createSelector(
  selectAuthState,
  (state) => state.refreshToken,
);
export const selectAuthLoading = createSelector(
  selectAuthState,
  (state) => state.loading,
);
export const selectAuthError = createSelector(
  selectAuthState,
  (state) => state.error,
);
export const selectAuthHydrated = createSelector(
  selectAuthState,
  (state) => state.hydrated,
);
