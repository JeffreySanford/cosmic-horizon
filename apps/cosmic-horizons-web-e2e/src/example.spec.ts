import { test, expect } from '@playwright/test';

function createFakeJwt(
  exp: number,
  claims: Record<string, string> = {},
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user-1', exp, ...claims }),
  ).toString('base64url');
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/landing');
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('h1')).toContainText('Login');
  await expect(
    page.getByRole('button', { name: 'Personalize background' }),
  ).toBeVisible();
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

  await page
    .locator('input[formcontrolname="email"]')
    .fill('test@cosmic.local');
  await page.locator('input[formcontrolname="password"]').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('h1')).toContainText('Login');
});

test('logs in and allows logout', async ({ page }) => {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'user-1',
        username: 'testuser',
        email: 'test@cosmic.local',
        display_name: 'Test User',
        role: 'user',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    );
  }, token);

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@cosmic.local',
          display_name: 'Test User',
          role: 'user',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 204,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: '',
    });
  });

  await page.goto('/landing', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/landing/, { timeout: 15000 });
  await expect(page.locator('h1')).toContainText(
    'Scientific Operations Gateway',
  );
  await expect(
    page.getByRole('heading', {
      name: 'Viewer, Permalinks, and Snapshots',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Community Research Notebook',
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('blocks access to logs when backend confirms non-admin role', async ({
  page,
}) => {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'user-1',
        username: 'testuser',
        email: 'test@cosmic.local',
        display_name: 'Test User',
        role: 'user',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    );
  }, token);

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@cosmic.local',
          display_name: 'Test User',
          role: 'user',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.goto('/landing', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/landing/, { timeout: 15000 });

  await page.evaluate(() => {
    window.history.pushState({}, '', '/logs');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/landing/);
});

test('allows admin user to open logs when backend confirms admin role', async ({
  page,
}) => {
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
      status: 201,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        access_token: token,
        token_type: 'Bearer',
        user: {
          id: 'admin-1',
          username: 'adminuser',
          email: 'admin@cosmic.local',
          display_name: 'Admin User',
          role: 'admin',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'admin-1',
          username: 'adminuser',
          email: 'admin@cosmic.local',
          display_name: 'Admin User',
          role: 'admin',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.goto('/auth/login');
  const loginEmail = page.getByRole('textbox', { name: 'Email' });
  const loginPassword = page.locator('input[formcontrolname="password"]');
  await expect(loginEmail).toBeVisible();
  await loginEmail.fill('admin@cosmic.local');
  await loginPassword.fill('AdminPassword123!');
  const loginButton = page.getByRole('button', { name: 'Login' });
  await expect(async () => {
    const loginResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/auth/login') &&
        response.status() === 201,
    );
    await loginButton.click();
    await loginResponse;
    await expect(page).toHaveURL(/\/landing/, { timeout: 5000 });
  }).toPass({ timeout: 30000 });

  await page.getByRole('button', { name: 'Logs' }).click();
  await expect(page).toHaveURL(/\/logs/);
  await expect(page.getByRole('heading', { name: 'Logger' })).toBeVisible();
});

test('creates viewer permalink and snapshot from pillar 2 flow', async ({
  page,
}) => {
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
        encoded_state:
          'eyJyYSI6MTg3LjI1LCJkZWMiOjIuMDUsImZvdiI6MS41LCJzdXJ2ZXkiOiJWTEFTUyJ9',
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
        encoded_state:
          'eyJyYSI6MTg3LjI1LCJkZWMiOjIuMDUsImZvdiI6MS41LCJzdXJ2ZXkiOiJWTEFTUyJ9',
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

  await page.goto('/view', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/view/);

  await page.getByRole('button', { name: 'Update URL State' }).first().click();
  await expect(page).toHaveURL(/state=/);

  await page.getByRole('button', { name: 'Create Permalink' }).first().click();
  await expect(page).toHaveURL(/\/view\/abc123xy/);

  await page.getByRole('button', { name: 'Save PNG Snapshot' }).first().click();

  await page.getByLabel('Center Label').fill('M87 Core');
  await page.getByRole('button', { name: 'Label Center' }).click();
  await expect(page.getByText(/M87 Core \(RA/)).toBeVisible();
});

test('creates a notebook post from pillar 3 flow', async ({ page }) => {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'user-1',
        username: 'astro',
        email: 'astro@cosmic.local',
        display_name: 'Astro User',
        role: 'user',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    );
  }, token);

  await page.route('**/api/posts**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }

    if (method === 'POST' && /\/api\/posts\/?$/.test(url)) {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id: 'post-1',
          user_id: 'user-1',
          title: 'M87 Notebook',
          content: 'Notebook markdown content for publishing flow.',
          status: 'draft',
          published_at: null,
          created_at: '2026-02-07T00:00:00.000Z',
          updated_at: '2026-02-07T00:00:00.000Z',
        }),
      });
      return;
    }

    if (method === 'POST' && url.includes('/api/posts/post-1/publish')) {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id: 'post-1',
          user_id: 'user-1',
          title: 'M87 Notebook',
          content: 'Notebook markdown content for publishing flow.',
          status: 'published',
          published_at: '2026-02-07T00:05:00.000Z',
          created_at: '2026-02-07T00:00:00.000Z',
          updated_at: '2026-02-07T00:05:00.000Z',
        }),
      });
      return;
    }

    if (method === 'GET' && url.includes('/api/posts/post-1')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id: 'post-1',
          user_id: 'user-1',
          title: 'M87 Notebook',
          content: 'Notebook markdown content for publishing flow.',
          status: 'draft',
          published_at: null,
          created_at: '2026-02-07T00:00:00.000Z',
          updated_at: '2026-02-07T00:00:00.000Z',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        user: {
          id: 'user-1',
          username: 'astro',
          email: 'astro@cosmic.local',
          display_name: 'Astro User',
          role: 'user',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.goto('/landing', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/landing/, { timeout: 15000 });

  await page
    .locator('article.feature-card', { hasText: 'Community Research Notebook' })
    .click();
  await expect(page).toHaveURL(/\/posts/);
  await page.getByRole('button', { name: 'New Draft' }).click();
  await expect(page).toHaveURL(/\/posts\/new/);
  const titleInput = page.getByLabel('Title');
  const contentInput = page.getByLabel('Markdown Content');
  await titleInput.fill('M87 Notebook');
  await contentInput.fill('Notebook markdown content for publishing flow.');
  await expect(titleInput).toHaveValue('M87 Notebook');
  await expect(contentInput).toHaveValue(
    'Notebook markdown content for publishing flow.',
  );
  await page.getByRole('button', { name: 'Save Draft' }).click();

  await expect(page).toHaveURL(/\/posts\/post-1/);
  await expect(page.getByText('Notebook Post')).toBeVisible();
});

test('syncs RA/Dec/FOV fields from Aladin view events', async ({ page }) => {
  await page.addInitScript(() => {
    type Callback = () => void;

    const callbacks: Record<string, Callback[]> = {};
    const fakeView = {
      position: [187.25, 2.05] as [number, number],
      fov: 1.5,
      listeners: callbacks,
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
        __cosmicFakeAladin: typeof fakeView;
        A: { init: Promise<void>; aladin: () => typeof fakeView };
      }
    ).__cosmicFakeAladin = fakeView;

    (
      window as unknown as {
        A: { init: Promise<void>; aladin: () => typeof fakeView };
      }
    ).A = {
      init: Promise.resolve(),
      aladin: () => fakeView,
    };
  });

  await page.goto('/view', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/view/);
  await page.waitForFunction(() => {
    const holder = window as unknown as {
      __cosmicFakeAladin: {
        listeners?: Record<string, Array<() => void>>;
      };
    };
    const listeners = holder.__cosmicFakeAladin.listeners ?? {};
    return (
      (listeners['positionChanged']?.length ?? 0) > 0 &&
      (listeners['zoomChanged']?.length ?? 0) > 0
    );
  });

  await page.evaluate(() => {
    const holder = window as unknown as {
      __cosmicFakeAladin: {
        position: [number, number];
        fov: number;
        emit: (event: string) => void;
      };
    };
    holder.__cosmicFakeAladin.position = [188.5, 3.75];
    holder.__cosmicFakeAladin.fov = 2.35;
    holder.__cosmicFakeAladin.emit('positionChanged');
    holder.__cosmicFakeAladin.emit('zoomChanged');
  });

  await expect(page.locator('input[formcontrolname="ra"]')).toHaveValue(
    '188.5',
    { timeout: 10000 },
  );
  await expect(page.locator('input[formcontrolname="dec"]')).toHaveValue(
    '3.75',
    { timeout: 10000 },
  );
  await expect(page.locator('input[formcontrolname="fov"]')).toHaveValue(
    '2.35',
    { timeout: 10000 },
  );
});

test('auto-selects higher-resolution survey when VLASS is deeply zoomed', async ({
  page,
}) => {
  await page.addInitScript(() => {
    type Callback = () => void;

    const callbacks: Record<string, Callback[]> = {};
    const fakeView = {
      position: [187.25, 2.05] as [number, number],
      fov: 1.5,
      lastSurvey: '',
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
      setImageSurvey(survey: string) {
        this.lastSurvey = survey;
      },
      getViewDataURL() {
        return Promise.resolve('data:image/png;base64,abc');
      },
      on(event: string, callback: Callback) {
        callbacks[event] = callbacks[event] ?? [];
        callbacks[event].push(callback);
      },
    };

    (
      window as unknown as {
        __cosmicFakeAladin: typeof fakeView;
        A: { init: Promise<void>; aladin: () => typeof fakeView };
      }
    ).__cosmicFakeAladin = fakeView;

    (
      window as unknown as {
        A: { init: Promise<void>; aladin: () => typeof fakeView };
      }
    ).A = {
      init: Promise.resolve(),
      aladin: () => fakeView,
    };
  });

  await page.goto('/view', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const holder = window as unknown as {
      __cosmicFakeAladin?: { setImageSurvey?: (survey: string) => void };
    };
    return typeof holder.__cosmicFakeAladin?.setImageSurvey === 'function';
  });
  await page.locator('select[formcontrolname="survey"]').selectOption('VLASS');
  await expect(page.locator('select[formcontrolname="survey"]')).toHaveValue(
    'VLASS',
  );
  await page.locator('input[formcontrolname="fov"]').fill('0.3');
  await page.locator('input[formcontrolname="fov"]').blur();

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        return (
          window as unknown as { __cosmicFakeAladin: { lastSurvey: string } }
        ).__cosmicFakeAladin.lastSurvey;
      });
    })
    .toBe('P/PanSTARRS/DR1/color-z-zg-g', { timeout: 10000 });
});

test('registers a user and redirects to landing', async ({ page }) => {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  await page.route('**/api/auth/register*', async (route) => {
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
          email: 'new@cosmic.local',
          display_name: 'newuser',
          role: 'user',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        user: {
          id: 'user-2',
          username: 'newuser',
          email: 'new@cosmic.local',
          display_name: 'newuser',
          role: 'user',
          created_at: '2026-02-07T00:00:00.000Z',
        },
      }),
    });
  });

  await page.goto('/auth/register');
  const registerUsername = page.getByRole('textbox', { name: 'Username' });
  const registerEmail = page.getByRole('textbox', { name: 'Email' });
  const registerPassword = page.locator('input[formcontrolname="password"]');
  const registerConfirmPassword = page.locator(
    'input[formcontrolname="confirmPassword"]',
  );
  await expect(page.locator('h1')).toContainText('Create Account');

  await registerUsername.fill('newuser');
  await registerEmail.fill('new@cosmic.local');
  await registerPassword.fill('Password123!');
  await registerConfirmPassword.fill('Password123!');
  const createAccountButton = page.getByRole('button', {
    name: 'Create Account',
  });
  await expect(createAccountButton).toBeEnabled();
  await expect(async () => {
    await createAccountButton.click();
    await expect(page).toHaveURL(/\/landing/, { timeout: 5000 });
  }).toPass({ timeout: 30000 });

  await expect(page.locator('h1')).toContainText(
    'Scientific Operations Gateway',
  );
});

test('shows conflict errors on duplicate registration', async ({ page }) => {
  await page.route('**/api/auth/register*', async (route) => {
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
  await page.getByRole('textbox', { name: 'Email' }).fill('test@cosmic.local');
  await page.locator('input[formcontrolname="password"]').fill('Password123!');
  await page
    .locator('input[formcontrolname="confirmPassword"]')
    .fill('Password123!');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(
    page.getByRole('button', { name: 'Create Account' }),
  ).toBeEnabled();

  await expect(page).toHaveURL(/\/auth\/register/);
  await expect(page).not.toHaveURL(/\/landing/);
});
