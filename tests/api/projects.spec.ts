import { test, expect } from '../../lib/fixtures.ts';
import {
  createProject,
  uniqueName,
  workspaceUrl,
  type Page,
  type Project,
} from '../../lib/api-client.ts';

// API-01
test('POST project returns 201 and echoes name and identifier @R5', async ({ api }) => {
  const name = uniqueName('create');
  const response = await api.post(`${workspaceUrl}/projects/`, {
    data: { name, identifier: 'QACREATE' },
  });
  expect(response.status()).toBe(201);

  const project = (await response.json()) as Project;
  expect(project.name).toBe(name);
  expect(project.identifier).toBe('QACREATE');
  expect(project.id).toBeTruthy();

  await api.delete(`${workspaceUrl}/projects/${project.id}/`);
});

// API-02
test('GET projects lists the created project inside a sane pagination envelope @R5', async ({
  api,
  testProject,
}) => {
  const response = await api.get(`${workspaceUrl}/projects/`);
  expect(response.status()).toBe(200);

  const page = (await response.json()) as Page<Project>;
  expect(page.count).toBe(page.results.length);
  expect(page.total_count).toBeGreaterThanOrEqual(page.count);
  expect(page.results.map((p) => p.id)).toContain(testProject.id);
});

// API-03
test('PATCH project name persists on the next GET @R5', async ({ api, testProject }) => {
  const newName = uniqueName('renamed');
  const patch = await api.patch(`${workspaceUrl}/projects/${testProject.id}/`, {
    data: { name: newName },
  });
  expect(patch.status()).toBe(200);

  const get = await api.get(`${workspaceUrl}/projects/${testProject.id}/`);
  expect(((await get.json()) as Project).name).toBe(newName);
});

// API-04
test('DELETE project succeeds and the next GET returns 404 @R5', async ({ api }) => {
  const project = await createProject(api);

  const del = await api.delete(`${workspaceUrl}/projects/${project.id}/`);
  expect(del.status()).toBe(204);

  const get = await api.get(`${workspaceUrl}/projects/${project.id}/`);
  expect(get.status()).toBe(404);
});

// API-13
test('POST project with an empty name returns 400 with a usable message @R7', async ({ api }) => {
  const response = await api.post(`${workspaceUrl}/projects/`, {
    data: { name: '', identifier: 'QAEMPTY' },
  });
  expect(response.status()).toBe(400);

  // The error must name the field so an integrator can act on it.
  const body = (await response.json()) as { name?: string[] };
  expect(body.name?.[0]).toMatch(/blank|required/i);
});
