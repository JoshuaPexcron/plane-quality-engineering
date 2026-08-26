import { test, expect } from '../../lib/fixtures.ts';
import { workspaceUrl, type Project } from '../../lib/api-client.ts';
import { requiredEnv } from '../../lib/env.ts';

// API-11
test('member token cannot delete a project, 403 and the project survives @R2', async ({
  api,
  memberApi,
  testProject,
}) => {
  const del = await memberApi.delete(`${workspaceUrl}/projects/${testProject.id}/`);
  expect(del.status()).toBe(403);

  const get = await api.get(`${workspaceUrl}/projects/${testProject.id}/`);
  expect(get.status()).toBe(200);
  expect(((await get.json()) as Project).id).toBe(testProject.id);
});

// API-12
test('token from one workspace gets no data from another workspace @R2', async ({ memberApi }) => {
  // The member belongs to the test workspace only; the seed script creates a
  // second workspace the member was never invited to.
  const otherWorkspace = requiredEnv('PLANE_OTHER_WORKSPACE_SLUG');
  const response = await memberApi.get(`/api/v1/workspaces/${otherWorkspace}/projects/`);
  expect([403, 404]).toContain(response.status());
  expect(await response.text()).not.toContain('"results"');
});
