import { test, expect } from '@playwright/test';

test('profile page loads public profile and hides loading indicator', async ({ page }) => {
  await page.goto('/profile/testuser');

  // Ensure the initial loading text is gone within a short timeout
  await expect(page.getByText('Loading profile...')).toHaveCount(0, { timeout: 5000 });

  // Profile display name should appear
  await expect(page.locator('mat-card-title')).toHaveText('Test User', { timeout: 5000 });

  // Posts list (seeded user has 0 posts) should render the empty message
  await expect(page.locator('.empty-message')).toHaveText("This user hasn't published any notebooks yet.", { timeout: 2000 });
});