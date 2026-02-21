import { createReducer, on } from '@ngrx/store';
import { SessionUser } from '../../../services/auth-session.service';
import * as AuthActions from './auth.actions';

export const authFeatureKey = 'auth';

export interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  authenticated: boolean;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  authenticated: false,
  hydrated: false,
  loading: false,
  error: null,
};

function mergeSession(
  state: AuthState,
  response: {
    access_token: string;
    refresh_token?: string;
    user: SessionUser;
  },
): AuthState {
  return {
    ...state,
    user: response.user,
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    authenticated: true,
    hydrated: true,
    loading: false,
    error: null,
  };
}

export const authReducer = createReducer(
  initialAuthState,
  on(
    AuthActions.authHydrateRequested,
    AuthActions.authLoginRequested,
    AuthActions.authRegisterRequested,
    AuthActions.authMeRequested,
    (state) => ({
      ...state,
      loading: true,
      error: null,
    }),
  ),
  on(AuthActions.authHydrated, (state, { session }) => {
    if (!session) {
      return {
        ...state,
        hydrated: true,
        loading: false,
      };
    }

    return mergeSession(state, session);
  }),
  on(
    AuthActions.authLoginSucceeded,
    AuthActions.authRegisterSucceeded,
    AuthActions.authSessionUpdated,
    (state, { response }) => mergeSession(state, response),
  ),
  on(AuthActions.authMeSucceeded, (state, { user }) => ({
    ...state,
    user,
    authenticated: true,
    hydrated: true,
    loading: false,
    error: null,
  })),
  on(
    AuthActions.authLoginFailed,
    AuthActions.authRegisterFailed,
    AuthActions.authMeFailed,
    (state, { error }) => ({
      ...state,
      loading: false,
      hydrated: true,
      error,
    }),
  ),
  on(AuthActions.authLogoutCompleted, AuthActions.authSessionCleared, () => ({
    ...initialAuthState,
    hydrated: true,
  })),
);
