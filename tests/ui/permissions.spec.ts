import { test, expect } from '../../lib/fixtures.ts';
import { requiredEnv } from '../../lib/env.ts';

const slug = requiredEnv('PLANE_WORKSPACE_SLUG');

// UI-15: a guest must not get creation controls. Runs with the guest storage
// state instead of the default admin one.
test.use({ storageState: 'playwright/.auth/guest.json' });

test('guest sees no create controls @R2', async ({ page }) => {
  await page.goto(`/${slug}/projects/`);
  // The sidebar renders for every role; for a guest its create button is
  // disabled and the project list offers no way to add a project.
  await expect(page.getByRole('button', { name: 'New work item' }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add Project' })).toBeHidden();
});
