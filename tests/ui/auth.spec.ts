import { test, expect } from '@playwright/test';
import { LoginPage } from '../../lib/pages/login-page.ts';
import { requiredEnv } from '../../lib/env.ts';

// Auth tests exercise the login flow itself, so they must start logged out
// instead of with the admin storage state the ui project loads by default.
test.use({ storageState: { cookies: [], origins: [] } });

// UI-02: a valid login must end on an authenticated page (workspace or onboarding),
// never back on the sign-in form.
test('login with valid credentials reaches an authenticated area @R1', async ({ page }) => {
  const login = new LoginPage(page);
  await login.signIn(requiredEnv('PLANE_ADMIN_EMAIL'), requiredEnv('PLANE_ADMIN_PASSWORD'));

  // Where exactly we land depends on account state (fresh account -> /onboarding/,
  // otherwise the workspace), so assert the invariant: we left the sign-in page.
  await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/sign-in'));
  await expect(login.email).toBeHidden();
});

// UI-05: a deep link into a workspace must bounce an anonymous visitor to the
// sign-in form, not show data or an error page.
test('anonymous visit to a workspace URL redirects to login @R1', async ({ page }) => {
  await page.goto(`/${requiredEnv('PLANE_WORKSPACE_SLUG')}/`);
  const login = new LoginPage(page);
  await expect(login.email).toBeVisible();
});

// UI-03: a wrong password must show a clear error and must not create a session.
test('login with a wrong password shows an error and no session @R1', async ({ page }) => {
  const login = new LoginPage(page);
  await login.signIn(requiredEnv('PLANE_ADMIN_EMAIL'), 'Definitely-Wrong-1!');
  await expect(page.getByRole('alert')).toContainText('Authentication failed');
  // No session: a workspace URL still bounces back to the sign-in form.
  await page.goto(`/${requiredEnv('PLANE_WORKSPACE_SLUG')}/`);
  await expect(login.email).toBeVisible();
});

// UI-04: logging out ends the session for real. The test signs in fresh
// instead of loading the shared admin storage state, because signing out
// would invalidate that state's session cookie for every later test.
test('logout returns to login and blocks workspace URLs @R1', async ({ page }) => {
  const login = new LoginPage(page);
  await login.signIn(requiredEnv('PLANE_ADMIN_EMAIL'), requiredEnv('PLANE_ADMIN_PASSWORD'));
  await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/sign-in'));

  // The avatar button is named with the user's initial, so match any single
  // capital letter; it is the only button with such a name.
  await page
    .getByRole('button', { name: /^[A-Z]$/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(login.email).toBeVisible();

  // The session is gone on the server, not only in the browser.
  await page.goto(`/${requiredEnv('PLANE_WORKSPACE_SLUG')}/`);
  await expect(login.email).toBeVisible();
});

// UI-01: sign-up must end in the onboarding wizard. Each run signs up a new
// unique user; Plane has no user delete, so the account stays behind. That is
// fine: CI instances are throwaway and locally the accounts are inert.
test('sign up a new user lands in onboarding @R1', async ({ page }) => {
  const email = `qa-signup-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/sign-up/');
  await page.getByPlaceholder('name@company.com').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('textbox', { name: 'Set a password' })
    .fill(requiredEnv('PLANE_TEST_PASSWORD'));
  await page
    .getByRole('textbox', { name: 'Confirm password' })
    .fill(requiredEnv('PLANE_TEST_PASSWORD'));
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding/');
  await expect(page.getByRole('heading', { name: 'Create your profile.' })).toBeVisible();
});
