import type { APIRequestContext, Page } from '@playwright/test';

const apiBase = process.env['API_BASE_URL'] ?? 'http://127.0.0.1:3000';

export type E2EAuthUser = {
  id?: string;
  username?: string;
  email?: string;
  display_name?: string;
  role?: string;
  created_at?: string;
};

type LoginResponse = {
  access_token?: string;
  user?: E2EAuthUser;
};

type LoginOptions = {
  email?: string;
  password?: string;
};

export async function loginViaApi(
  request: APIRequestContext,
  options?: LoginOptions,
) {
  const email = options?.email ?? 'test@cosmic.local';
  const password = options?.password ?? 'Password123!';
  const login = await request.post(`${apiBase}/api/auth/login`, {
    data: { email, password },
  });

  if (login.status() !== 201) {
    throw new Error(`E2E login failed (${login.status()}) for ${email}`);
  }

  const payload = (await login.json()) as LoginResponse;
  if (!payload.access_token) {
    throw new Error(`E2E login returned no access_token for ${email}`);
  }

  const fallbackUsername = email.split('@')[0] || 'user';
  const user: E2EAuthUser = {
    id: payload.user?.id ?? fallbackUsername,
    username: payload.user?.username ?? fallbackUsername,
    email,
    display_name: payload.user?.display_name ?? fallbackUsername,
    role: payload.user?.role ?? 'user',
    created_at: payload.user?.created_at ?? new Date().toISOString(),
  };

  return { token: payload.access_token, user };
}

export async function primeAuthenticatedSession(
  page: Page,
  request: APIRequestContext,
  options?: LoginOptions,
) {
  const { token, user } = await loginViaApi(request, options);
  await page.addInitScript(
    ({ jwt, authUser }) => {
      window.sessionStorage.setItem('auth_token', jwt);
      window.sessionStorage.setItem('auth_user', JSON.stringify(authUser));
    },
    { jwt: token, authUser: user },
  );
  return { token, user };
}
