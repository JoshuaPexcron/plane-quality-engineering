import type { Locator, Page } from '@playwright/test';
import { requiredEnv } from '../env.ts';

// One project's work item list: the toolbar, the create modal and the rows.
// Shared by the work item tests. The detail page is not modeled here; only
// two tests touch it, and two uses don't earn an abstraction.
export class WorkItemsPage {
  readonly addItem: Locator;
  readonly dialog: Locator;
  readonly filterButton: Locator;
  readonly clearFilters: Locator;

  constructor(
    private page: Page,
    private projectId: string,
  ) {
    this.addItem = page.getByRole('button', { name: 'Add work item' });
    this.dialog = page.getByRole('dialog');
    // The filter button has no accessible name; only its icon identifies it.
    this.filterButton = page.locator('button:has(svg.lucide-list-filter)').first();
    this.clearFilters = this.content.getByRole('button', { name: 'Clear all' });
  }

  // The inner <main> is the content area; the outer one wraps the app shell.
  get content(): Locator {
    return this.page.locator('main').last();
  }

  async goto() {
    await this.page.goto(
      `/${requiredEnv('PLANE_WORKSPACE_SLUG')}/projects/${this.projectId}/issues`,
    );
  }

  row(name: string): Locator {
    return this.content.getByRole('link', { name });
  }

  // Opens the filter dropdown, picks a category (State, Assignees, ...) and
  // one value, then closes the dropdown; the filter applies immediately.
  async filterBy(category: string, value: string) {
    await this.filterButton.click();
    await this.page.getByRole('option', { name: category, exact: true }).click();
    await this.page.getByRole('option', { name: value }).click();
    await this.page.keyboard.press('Escape');
  }
}
