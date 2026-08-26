import { test, expect } from '../../lib/fixtures.ts';
import {
  createWorkItem,
  listStates,
  workspaceUrl,
  type Comment,
  type Page,
  type WorkItem,
} from '../../lib/api-client.ts';

// API-05
test('POST work item returns 201 and the fields match what was sent @R5', async ({
  api,
  testProject,
}) => {
  const response = await api.post(`${workspaceUrl}/projects/${testProject.id}/issues/`, {
    data: { name: 'qa-created-item', priority: 'high' },
  });
  expect(response.status()).toBe(201);

  const item = (await response.json()) as WorkItem;
  expect(item.name).toBe('qa-created-item');
  expect(item.priority).toBe('high');
  expect(item.project).toBe(testProject.id);
});

// API-06
test('PATCH work item state and priority, both persist @R5', async ({ api, testProject }) => {
  const item = await createWorkItem(api, testProject.id, { name: 'qa-patch-item' });
  const states = await listStates(api, testProject.id);
  const done = states.find((s) => s.group === 'completed');
  expect(done, 'project has a "completed" state').toBeDefined();

  const patch = await api.patch(`${workspaceUrl}/projects/${testProject.id}/issues/${item.id}/`, {
    data: { state: done!.id, priority: 'urgent' },
  });
  expect(patch.status()).toBe(200);

  const get = await api.get(`${workspaceUrl}/projects/${testProject.id}/issues/${item.id}/`);
  const updated = (await get.json()) as WorkItem;
  expect(updated.state).toBe(done!.id);
  expect(updated.priority).toBe('urgent');
});

// API-07
test('GET work items lists every created item with its state @R5', async ({ api, testProject }) => {
  const states = await listStates(api, testProject.id);
  const backlog = states.find((s) => s.group === 'backlog')!;
  const started = states.find((s) => s.group === 'started')!;
  const a = await createWorkItem(api, testProject.id, { name: 'qa-list-a', state: backlog.id });
  const b = await createWorkItem(api, testProject.id, { name: 'qa-list-b', state: started.id });

  // Plane's public API offers no state filter on this endpoint: a ?state=
  // query parameter is silently ignored and the full list comes back. So the
  // contract to verify is the list itself: complete, with correct states.
  const response = await api.get(`${workspaceUrl}/projects/${testProject.id}/issues/`);
  expect(response.status()).toBe(200);

  const items = ((await response.json()) as Page<WorkItem>).results;
  expect(items).toHaveLength(2);
  expect(items.find((i) => i.id === a.id)?.state).toBe(backlog.id);
  expect(items.find((i) => i.id === b.id)?.state).toBe(started.id);
});

// API-08
test('DELETE work item removes it from the next list @R5', async ({ api, testProject }) => {
  const item = await createWorkItem(api, testProject.id, { name: 'qa-delete-item' });

  const del = await api.delete(`${workspaceUrl}/projects/${testProject.id}/issues/${item.id}/`);
  expect(del.status()).toBe(204);

  const list = await api.get(`${workspaceUrl}/projects/${testProject.id}/issues/`);
  const ids = ((await list.json()) as Page<WorkItem>).results.map((i) => i.id);
  expect(ids).not.toContain(item.id);
});

// API-14
test('POST work item with an invalid priority returns 400, not silent acceptance @R7', async ({
  api,
  testProject,
}) => {
  const response = await api.post(`${workspaceUrl}/projects/${testProject.id}/issues/`, {
    data: { name: 'qa-bad-priority', priority: 'bananas' },
  });
  expect(response.status()).toBe(400);

  const body = (await response.json()) as { priority?: string[] };
  expect(body.priority?.[0]).toContain('not a valid choice');
});

// API-15
test('POST comment shows up in GET with the right author @R6', async ({ api, testProject }) => {
  const item = await createWorkItem(api, testProject.id, { name: 'qa-comment-item' });
  const commentsUrl = `${workspaceUrl}/projects/${testProject.id}/issues/${item.id}/comments/`;

  const post = await api.post(commentsUrl, { data: { comment_html: '<p>qa comment</p>' } });
  expect(post.status()).toBe(201);

  const me = (await (await api.get('/api/v1/users/me/')).json()) as { id: string };
  const list = await api.get(commentsUrl);
  const comments = ((await list.json()) as Page<Comment>).results;
  expect(comments).toHaveLength(1);
  expect(comments[0].comment_html).toBe('<p>qa comment</p>');
  expect(comments[0].created_by).toBe(me.id);
});
