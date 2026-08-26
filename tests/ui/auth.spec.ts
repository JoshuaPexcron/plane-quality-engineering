import { test, expect } from '@playwright/test';
import { requiredEnv } from '../../lib/env.ts';

// UI-02: a valid login must end on an authenticated page (workspace or onboarding),
// never back on the sign-in form.
test('login with valid credentials reaches an authenticated area @R1', async ({ page }) => {
  await page.goto('/');

  // Plane's sign-in is a two-step form: email first, then password.
  await page.getByPlaceholder('name@company.com').fill(requiredEnv('PLANE_ADMIN_EMAIL'));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Enter password').fill(requiredEnv('PLANE_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: 'Go to workspace' }).click();

  // Where exactly we land depends on account state (fresh account -> /onboarding/,
  // otherwise the workspace), so assert the invariant: we left the sign-in page.
  await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/sign-in'));
  await expect(page.getByPlaceholder('name@company.com')).toBeHidden();
});
