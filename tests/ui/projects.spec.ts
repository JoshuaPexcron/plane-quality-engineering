import { test, expect } from '../../lib/fixtures.ts';
import {
  uniqueName,
  uniqueIdentifier,
  deleteProject,
  workspaceUrl,
  type Paginated,
  type Project,
} from '../../lib/api-client.ts';
import { requiredEnv } from '../../lib/env.ts';

const slug = requiredEnv('PLANE_WORKSPACE_SLUG');

// UI-06: creating a project through the UI must make it show up where users
// look for it: the project list and the sidebar. Cleanup goes through the
// API, deleting through the UI is its own test (UI-08).
test('create a project shows it in sidebar and project list @R4', async ({ page, api }) => {
  const name = uniqueName('ui project');
  await page.goto(`/${slug}/projects/`);
  await page.getByRole('button', { name: 'Add Project' }).first().click();
  await page.getByRole('textbox', { name: 'Project name' }).fill(name);
  await page.getByRole('textbox', { name: 'Project ID' }).fill(uniqueIdentifier());
  await page.getByRole('button', { name: 'Create project' }).click();

  // Creating does not navigate: the modal turns into a feature-toggle step
  // with a confirmation. Close it, then verify where the project shows up.
  await expect(page.getByRole('dialog').getByText(name)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  try {
    const sidebar = page.getByRole('complementary', { name: 'Main sidebar' });
    await expect(sidebar.getByText(name)).toBeVisible();
    await page.goto(`/${slug}/projects/`);
    await expect(page.getByRole('main').last().getByText(name)).toBeVisible();
  } finally {
    // The UI never showed the new project's id, so look it up by name.
    const response = await api.get(`${workspaceUrl}/projects/`);
    const projects = ((await response.json()) as Paginated<Project>).results;
    const created = projects.find((p) => p.name === name);
    if (created) await deleteProject(api, created.id);
  }
});

// UI-07: renaming a project in settings must survive a reload, proving the
// change reached the server and not only the form state.
test('edit project name survives a reload @R4', async ({ page, testProject }) => {
  const newName = uniqueName('renamed');
  await page.goto(`/${slug}/settings/projects/${testProject.id}/`);
  const nameBox = page.getByRole('textbox', { name: 'Project name' });
  await nameBox.fill(newName);
  // Wait for the PATCH to land before reloading, otherwise the reload can
  // race the save and read the old name.
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes(testProject.id),
  );
  await page.getByRole('button', { name: 'Update project' }).click();
  await saved;
  await page.reload();
  await expect(nameBox).toHaveValue(newName);
});

// UI-08: deleting a project must sit behind a typed confirmation, and the
// delete must actually happen once confirmed.
test('delete project requires typed confirmation @R4', async ({ page, api, testProject }) => {
  await page.goto(`/${slug}/settings/projects/${testProject.id}/`);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Delete project' })).toBeVisible();

  // The guard: the confirm button stays disabled until the user types the
  // project name and the literal phrase.
  const confirm = dialog.getByRole('button', { name: 'Delete project' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Project name' }).fill(testProject.name);
  await dialog
    .getByRole('textbox', { name: "Enter 'delete my project'" })
    .fill('delete my project');
  await confirm.click();
  await expect(dialog).toBeHidden();

  // Gone for real, not only from the screen.
  const response = await api.get(`${workspaceUrl}/projects/${testProject.id}/`);
  expect(response.status()).toBe(404);
});
