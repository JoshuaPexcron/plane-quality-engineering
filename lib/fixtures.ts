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

export const test = base.extend<Fixtures>({
  // Playwright requires the destructuring pattern even with no dependencies.
  // eslint-disable-next-line no-empty-pattern
  api: async ({}, use) => {
    const api = await newApiContext(requiredEnv('PLANE_API_TOKEN'));
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
