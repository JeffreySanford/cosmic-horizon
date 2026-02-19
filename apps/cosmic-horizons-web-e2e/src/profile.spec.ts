import { test, expect } from '@playwright/test';

test('profile page loads public profile and hides loading indicator', async ({
  page,
}) => {
  // Stub the profile API so this test is hermetic and never depends on backend DB state
  await page.route('**/api/profiles/testuser', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        user: {
          username: 'testuser',
          display_name: 'Test User',
          created_at: new Date().toISOString(),
        },
        posts: [],
      }),
    });
  });

  await page.goto('/profile/testuser');

  // Ensure the initial loading text is gone within a short timeout
  await expect(page.getByText('Loading profile...')).toHaveCount(0, {
    timeout: 5000,
  });

  // Profile display name should appear
  await expect(page.locator('mat-card-title')).toHaveText('Test User', {
    timeout: 5000,
  });

  // Posts list (seeded user has 0 posts) should render the empty message
  await expect(page.locator('.empty-message')).toHaveText(
    "This user hasn't published any notebooks yet.",
    { timeout: 2000 },
  );
});
