import { test, expect } from '@playwright/test';

function createFakeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'user-1', exp })).toString('base64url');
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
}

test('redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/landing');
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('h1')).toContainText('Login');
  await expect(page.getByRole('button', { name: 'Personalize background' })).toBeVisible();
});

test('shows error for invalid credentials', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({ message: 'Invalid email or password' }),
    });
  });

  await page.goto('/auth/login');

  await page.locator('input[formcontrolname="email"]').fill('test@vlass.local');
  await page.locator('input[formcontrolname="password"]').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('h1')).toContainText('Login');
});

test('logs in and allows logout', async ({ page }) => {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  await page.route('**/api/auth/login', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        access_token: token,
        token_type: 'Bearer',
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@vlass.local',
          display_name: 'Test User',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.goto('/auth/login');
  await page.locator('input[formcontrolname="email"]').fill('test@vlass.local');
  await page.locator('input[formcontrolname="password"]').fill('Password123!');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/landing/);
  await expect(page.locator('h1')).toContainText('Welcome back, Test User');
  await expect(page.getByRole('heading', { name: 'Instant SSR First Paint', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Viewer, Permalinks, and Snapshots', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Community Research Notebook', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('creates viewer permalink and snapshot from pillar 2 flow', async ({ page }) => {
  await page.route('**/api/view/state', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        id: 'state-1',
        short_id: 'abc123xy',
        encoded_state: 'eyJyYSI6MTg3LjI1LCJkZWMiOjIuMDUsImZvdiI6MS41LCJzdXJ2ZXkiOiJWTEFTUyJ9',
        state: {
          ra: 187.25,
          dec: 2.05,
          fov: 1.5,
          survey: 'VLASS',
        },
        permalink_path: '/view/abc123xy',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    });
  });

  await page.route('**/api/view/snapshot', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        id: 'snapshot-1',
        image_url: '/api/view/snapshots/snapshot-1.png',
        short_id: 'abc123xy',
        size_bytes: 1024,
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    });
  });

  await page.route(/\/api\/view\/abc123xy\/?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        id: 'state-1',
        short_id: 'abc123xy',
        encoded_state: 'eyJyYSI6MTg3LjI1LCJkZWMiOjIuMDUsImZvdiI6MS41LCJzdXJ2ZXkiOiJWTEFTUyJ9',
        state: {
          ra: 187.25,
          dec: 2.05,
          fov: 1.5,
          survey: 'VLASS',
        },
        permalink_path: '/view/abc123xy',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    });
  });

  await page.goto('/view');
  await expect(page).toHaveURL(/\/view/);

  await page.getByRole('button', { name: 'Update URL State' }).click();
  await expect(page).toHaveURL(/state=/);

  await page.getByRole('button', { name: 'Create Permalink' }).click();
  await expect(page).toHaveURL(/\/view\/abc123xy/);

  await page.getByRole('button', { name: 'Save PNG Snapshot' }).click();
});

test('syncs RA/Dec/FOV fields from Aladin view events', async ({ page }) => {
  await page.addInitScript(() => {
    type Callback = () => void;

    const callbacks: Record<string, Callback[]> = {};
    const fakeView = {
      position: [187.25, 2.05] as [number, number],
      fov: 1.5,
      gotoRaDec(ra: number, dec: number) {
        this.position = [ra, dec];
      },
      setFoV(fov: number) {
        this.fov = fov;
      },
      getRaDec() {
        return this.position;
      },
      getFov() {
        return this.fov;
      },
      setImageSurvey() {
        return undefined;
      },
      getViewDataURL() {
        return Promise.resolve('data:image/png;base64,abc');
      },
      on(event: string, callback: Callback) {
        callbacks[event] = callbacks[event] ?? [];
        callbacks[event].push(callback);
      },
      emit(event: string) {
        for (const callback of callbacks[event] ?? []) {
          callback();
        }
      },
    };

    (
      window as unknown as {
        __vlassFakeAladin: typeof fakeView;
        A: { init: Promise<void>; aladin: () => typeof fakeView };
      }
    ).__vlassFakeAladin = fakeView;

    (
      window as unknown as {
        A: { init: Promise<void>; aladin: () => typeof fakeView };
      }
    ).A = {
      init: Promise.resolve(),
      aladin: () => fakeView,
    };
  });

  await page.goto('/view');
  await expect(page).toHaveURL(/\/view/);

  await page.evaluate(() => {
    const holder = window as unknown as {
      __vlassFakeAladin: {
        position: [number, number];
        fov: number;
        emit: (event: string) => void;
      };
    };
    holder.__vlassFakeAladin.position = [188.5, 3.75];
    holder.__vlassFakeAladin.fov = 2.35;
    holder.__vlassFakeAladin.emit('positionChanged');
    holder.__vlassFakeAladin.emit('zoomChanged');
  });

  await expect(page.locator('input[formcontrolname="ra"]')).toHaveValue('188.5');
  await expect(page.locator('input[formcontrolname="dec"]')).toHaveValue('3.75');
  await expect(page.locator('input[formcontrolname="fov"]')).toHaveValue('2.35');
});

test('registers a user and redirects to landing', async ({ page }) => {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  await page.route('**/api/auth/register', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        access_token: token,
        token_type: 'Bearer',
        user: {
          id: 'user-2',
          username: 'newuser',
          email: 'new@vlass.local',
          display_name: 'newuser',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.goto('/auth/register');
  await page.getByRole('textbox', { name: 'Username' }).fill('newuser');
  await page.getByRole('textbox', { name: 'Email' }).fill('new@vlass.local');
  await page.locator('input[formcontrolname="password"]').fill('Password123!');
  await page.locator('input[formcontrolname="confirmPassword"]').fill('Password123!');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page).toHaveURL(/\/landing/);
  await expect(page.locator('h1')).toContainText('Welcome back');
});

test('shows conflict errors on duplicate registration', async ({ page }) => {
  await page.route('**/api/auth/register', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }

    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({ message: 'Email is already in use.' }),
    });
  });

  await page.goto('/auth/register');
  await page.getByRole('textbox', { name: 'Username' }).fill('testuser');
  await page.getByRole('textbox', { name: 'Email' }).fill('test@vlass.local');
  await page.locator('input[formcontrolname="password"]').fill('Password123!');
  await page.locator('input[formcontrolname="confirmPassword"]').fill('Password123!');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page).toHaveURL(/\/auth\/register/);
  await expect(page.getByText('Email is already in use.')).toBeVisible();
});
