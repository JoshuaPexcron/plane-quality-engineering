// The shared fixtures, not bare Playwright: the page fixture there serves
// /api/instances/ from cache, and the three sign-in loads must not spend
// the anonymous rate-limit budget either.
import { test as setup, expect } from '../../lib/fixtures.ts';
import { LoginPage } from '../../lib/pages/login-page.ts';
import { requiredEnv } from '../../lib/env.ts';

// Signs in each role once through the UI and saves the browser state
// (session cookie) to a file. The ui project loads these files, so the
// tests start already authenticated instead of logging in 15 times.
const roles = [
  { name: 'admin', email: 'PLANE_ADMIN_EMAIL', password: 'PLANE_ADMIN_PASSWORD' },
  { name: 'member', email: 'PLANE_MEMBER_EMAIL', password: 'PLANE_TEST_PASSWORD' },
  { name: 'guest', email: 'PLANE_GUEST_EMAIL', password: 'PLANE_TEST_PASSWORD' },
];

for (const role of roles) {
  setup(`sign in as ${role.name}`, async ({ page }) => {
    const login = new LoginPage(page);
    await login.signIn(requiredEnv(role.email), requiredEnv(role.password));
    // Signed in = we left the sign-in page. Assert before saving, so a broken
    // login fails here with a clear name instead of in every UI test.
    await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/sign-in'));
    await expect(login.email).toBeHidden();
    await page.context().storageState({ path: `playwright/.auth/${role.name}.json` });
  });
}
