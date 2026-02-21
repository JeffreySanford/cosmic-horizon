import { createAction, props } from '@ngrx/store';
import {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from '../../../features/auth/auth-api.service';

export const authHydrateRequested = createAction('[Auth] Hydrate Requested');
export const authHydrated = createAction(
  '[Auth] Hydrated',
  props<{ session: LoginResponse | null }>(),
);

export const authLoginRequested = createAction(
  '[Auth] Login Requested',
  props<{ request: LoginRequest }>(),
);
export const authLoginSucceeded = createAction(
  '[Auth] Login Succeeded',
  props<{ response: LoginResponse }>(),
);
export const authLoginFailed = createAction(
  '[Auth] Login Failed',
  props<{ error: string }>(),
);

export const authRegisterRequested = createAction(
  '[Auth] Register Requested',
  props<{ request: RegisterRequest }>(),
);
export const authRegisterSucceeded = createAction(
  '[Auth] Register Succeeded',
  props<{ response: LoginResponse }>(),
);
export const authRegisterFailed = createAction(
  '[Auth] Register Failed',
  props<{ error: string }>(),
);

export const authMeRequested = createAction('[Auth] Me Requested');
export const authMeSucceeded = createAction(
  '[Auth] Me Succeeded',
  props<{ user: AuthenticatedUser }>(),
);
export const authMeFailed = createAction(
  '[Auth] Me Failed',
  props<{ error: string }>(),
);

export const authLogoutRequested = createAction('[Auth] Logout Requested');
export const authLogoutCompleted = createAction('[Auth] Logout Completed');

export const authSessionUpdated = createAction(
  '[Auth] Session Updated',
  props<{ response: LoginResponse }>(),
);
export const authSessionCleared = createAction('[Auth] Session Cleared');
