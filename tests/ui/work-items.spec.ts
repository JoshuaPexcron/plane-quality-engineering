import { test, expect } from '../../lib/fixtures.ts';
import { createWorkItem, listStates, uniqueName } from '../../lib/api-client.ts';
import { requiredEnv } from '../../lib/env.ts';
import { WorkItemsPage } from '../../lib/pages/work-items-page.ts';

const slug = requiredEnv('PLANE_WORKSPACE_SLUG');

// The inner <main> is the content area; used directly by the detail-page
// tests, which don't go through the WorkItemsPage object.
const content = (page: import('@playwright/test').Page) => page.locator('main').last();

// UI-09: create a work item with title, priority and assignee through the
// modal; it must appear in the project's work item list.
test('create a work item with title, priority and assignee @R3', async ({ page, testProject }) => {
  const items = new WorkItemsPage(page, testProject.id);
  const name = uniqueName('ui item');
  await items.goto();
  await items.addItem.click();

  await items.dialog.getByRole('textbox', { name: 'Title' }).fill(name);
  // Priority defaults to "None"; pick High from its listbox.
  await items.dialog.getByRole('button', { name: 'None' }).click();
  await page.getByRole('option', { name: 'High' }).click();
  // Assign the first member offered (the concrete names differ per instance).
  await items.dialog.getByRole('button', { name: 'Assignees' }).first().click();
  await page.getByRole('option').first().click();
  await page.keyboard.press('Escape');
  await items.dialog.getByRole('button', { name: 'Save' }).click();

  await expect(items.row(name)).toBeVisible();
});

// UI-10: edit title and priority on the detail page; both survive a reload.
test('edit work item title and priority persists after reload @R3', async ({
  page,
  api,
  testProject,
}) => {
  await createWorkItem(api, testProject.id, { name: uniqueName('item'), priority: 'high' });
  const newTitle = uniqueName('renamed item');

  await page.goto(`/${slug}/browse/${testProject.identifier}-1/`);
  const title = page.getByRole('textbox', { name: 'Work item title' });
  // The title autosaves on change; wait for the PATCH before reloading.
  const savedTitle = page.waitForResponse((r) => r.request().method() === 'PATCH');
  await title.fill(newTitle);
  await savedTitle;

  const savedPriority = page.waitForResponse((r) => r.request().method() === 'PATCH');
  await content(page).getByRole('button', { name: 'High' }).click();
  await page.getByRole('option', { name: 'Urgent' }).click();
  await savedPriority;

  await page.reload();
  await expect(title).toHaveValue(newTitle);
  await expect(content(page).getByRole('button', { name: 'Urgent' })).toBeVisible();
});

// UI-11: change a work item's state from the list row; the view reflects it,
// also after a reload.
test('change work item state is reflected in the list @R3', async ({ page, api, testProject }) => {
  const name = uniqueName('item');
  await createWorkItem(api, testProject.id, { name });

  const items = new WorkItemsPage(page, testProject.id);
  await items.goto();
  const row = items.row(name);
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH');
  await row.getByRole('button', { name: 'Backlog' }).first().click();
  await page.getByRole('option', { name: 'Done' }).click();
  await saved;

  await expect(row.getByRole('button', { name: 'Done' }).first()).toBeVisible();
  await page.reload();
  await expect(row.getByRole('button', { name: 'Done' }).first()).toBeVisible();
});

// UI-13: an empty title must not create a work item; the modal stays open
// and names the problem.
test('creating a work item with an empty title is blocked @R7', async ({ page, testProject }) => {
  const items = new WorkItemsPage(page, testProject.id);
  await items.goto();
  await items.addItem.click();
  await items.dialog.getByRole('button', { name: 'Save' }).click();
  // The dialog wrapper has no bounding box of its own, so assert on its
  // visible children: the form is still there and names the problem.
  await expect(page.getByText('Title is required')).toBeVisible();
  await expect(items.dialog.getByRole('textbox', { name: 'Title' })).toBeVisible();
});

// UI-14: a comment must show up in the activity feed under the author's name.
test('add a comment shows it with the author @R6', async ({ page, api, testProject }) => {
  await createWorkItem(api, testProject.id, { name: uniqueName('item') });
  const text = `qa comment ${Date.now()}`;

  await page.goto(`/${slug}/browse/${testProject.identifier}-1/`);
  // The comment editor is a rich-text contenteditable, not a form field.
  await content(page).locator('[contenteditable="true"]').last().click();
  await page.keyboard.type(text);
  await content(page).getByRole('button', { name: 'Comment', exact: true }).click();

  await expect(content(page).getByText(text)).toBeVisible();
  // Attribution: the activity entry links to the author's profile.
  await expect(
    content(page)
      .getByRole('link', { name: /qa|admin|joshua/i })
      .last(),
  ).toBeVisible();
});

// UI-12: filtering by state and by assignee must narrow the list to matching
// items. Setup via API: one item assigned to the current user, one in Done.
test('filter work items by state and by assignee @R3', async ({ page, api, testProject }) => {
  const me = (await (await api.get('/api/v1/users/me/')).json()) as {
    id: string;
    display_name: string;
  };
  const states = await listStates(api, testProject.id);
  const done = states.find((s) => s.group === 'completed');
  expect(done, 'project should have a completed state').toBeDefined();
  const nameA = uniqueName('itemA');
  const nameB = uniqueName('itemB');
  await createWorkItem(api, testProject.id, { name: nameA, assignees: [me.id] });
  await createWorkItem(api, testProject.id, { name: nameB, state: done!.id });

  const items = new WorkItemsPage(page, testProject.id);
  await items.goto();
  await expect(items.row(nameA)).toBeVisible();
  await expect(items.row(nameB)).toBeVisible();

  await items.filterBy('State', 'Done');
  await expect(items.clearFilters).toBeVisible();
  await expect(items.row(nameB)).toBeVisible();
  await expect(items.row(nameA)).toBeHidden();

  await items.clearFilters.click();
  await expect(items.row(nameA)).toBeVisible();

  // Reload so the second filter starts from a fresh page; reopening the
  // dropdown right after clearing leaves it in a stuck half-open state.
  await page.reload();
  await expect(items.row(nameA)).toBeVisible();
  await items.filterBy('Assignees', me.display_name);
  await expect(items.row(nameA)).toBeVisible();
  await expect(items.row(nameB)).toBeHidden();
});
