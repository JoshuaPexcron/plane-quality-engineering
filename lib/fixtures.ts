import { test as base, type APIRequestContext } from '@playwright/test';
import { createProject, deleteProject, newApiContext, type Project } from './api-client.ts';
import { requiredEnv } from './env.ts';

// Custom fixtures: each test that asks for one gets it set up before and
// torn down after, so tests stay independent and leave nothing behind.
type Fixtures = {
  api: APIRequestContext; // admin token
  memberApi: APIRequestContext; // member token, for permission tests
  testProject: Project; // fresh project per test, deleted afterwards
};

// One copy of the /api/instances/ response per worker, fetched once.
let instancesBody: string | undefined;

export const test = base.extend<Fixtures>({
  // Plane's frontend bootstraps every page load with an anonymous call to
  // /api/instances/, and the server allows 30 anonymous requests per minute
  // per IP. All test browsers share one IP, so a full run exceeds the
  // budget and page loads stall on retries or die on Plane's error screen
  // (the UI-07 flake; see docs/bugs/). The response is static instance
  // metadata and not behavior under test, so every page serves it from a
  // one-time cached copy instead of spending the shared budget.
  page: async ({ page, request }, use) => {
    if (!instancesBody) {
      const response = await request.get('/api/instances/');
      if (response.ok()) instancesBody = await response.text();
    }
    if (instancesBody) {
      const body = instancesBody;
      await page.route('**/api/instances/', (route) =>
        route.fulfill({ contentType: 'application/json', body }),
      );
    }
    await use(page);
  },
  // Playwright requires the destructuring pattern even with no dependencies.
  // eslint-disable-next-line no-empty-pattern
  api: async ({}, use, testInfo) => {
    // The API suite gets its own token: together with the browser projects
    // it would exceed one token's 60 requests-per-minute budget. The a11y
    // scans share the UI token, their handful of setup calls fit in there.
    const name = testInfo.project.name === 'api' ? 'PLANE_API_TOKEN' : 'PLANE_UI_API_TOKEN';
    const api = await newApiContext(requiredEnv(name));
    await use(api);
    await api.dispose();
  },

  // eslint-disable-next-line no-empty-pattern
  memberApi: async ({}, use) => {
    const api = await newApiContext(requiredEnv('PLANE_MEMBER_API_TOKEN'));
    await use(api);
    await api.dispose();
  },

  testProject: async ({ api }, use) => {
    const project = await createProject(api);
    await use(project);
    await deleteProject(api, project.id);
  },
});

export { expect } from '@playwright/test';
