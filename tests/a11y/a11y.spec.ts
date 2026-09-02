import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../lib/fixtures.ts';
import { createWorkItem, uniqueName } from '../../lib/api-client.ts';
import { requiredEnv } from '../../lib/env.ts';
import { LoginPage } from '../../lib/pages/login-page.ts';
import type { Page, TestInfo } from '@playwright/test';

const slug = requiredEnv('PLANE_WORKSPACE_SLUG');

// Known critical violations per page. The scans are informational: Plane's
// code is not mine to fix, so only a NEW critical rule beyond this baseline
// fails the run. Everything else is reported to the dashboard.
const baseline: Record<string, string[]> = JSON.parse(
  readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'),
);

// Runs axe on the current page state, attaches the summary for the
// dashboard, and fails only on critical rules missing from the baseline.
async function scan(page: Page, testInfo: TestInfo, key: string) {
  const results = await new AxeBuilder({ page }).analyze();

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const violation of results.violations) {
    if (violation.impact && violation.impact in counts) {
      counts[violation.impact as keyof typeof counts] += 1;
    }
  }
  // The attachment body lands inside Playwright's JSON report, where the
  // dashboard build script picks it up. No extra files to ship around.
  await testInfo.attach('a11y-summary', {
    body: JSON.stringify({ page: key, counts }),
    contentType: 'application/json',
  });

  const critical = results.violations.filter((v) => v.impact === 'critical').map((v) => v.id);
  const newCritical = critical.filter((id) => !baseline[key].includes(id));
  expect(newCritical, `critical rules not in the ${key} baseline`).toEqual([]);
}

// A11Y-01: the login page is the one page every user must get through.
test.describe('logged out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a11y scan of the login page @R8', async ({ page }, testInfo) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.email).toBeVisible();
    await scan(page, testInfo, 'login');
  });
});

// A11Y-02: the work item list, Plane's most used screen.
test('a11y scan of the work item list @R8', async ({ page, api, testProject }, testInfo) => {
  const name = uniqueName('a11y item');
  await createWorkItem(api, testProject.id, { name });
  await page.goto(`/${slug}/projects/${testProject.id}/issues/`);
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  await scan(page, testInfo, 'work-item-list');
});

// A11Y-03: the work item detail page, where editing happens.
test('a11y scan of the work item detail page @R8', async ({ page, api, testProject }, testInfo) => {
  const name = uniqueName('a11y item');
  await createWorkItem(api, testProject.id, { name });
  await page.goto(`/${slug}/browse/${testProject.identifier}-1/`);
  await expect(page.getByRole('textbox', { name: 'Work item title' })).toHaveValue(name);
  await scan(page, testInfo, 'work-item-detail');
});
