import { request, type APIRequestContext } from '@playwright/test';
import { requiredEnv } from './env.ts';

// The public REST API lives under /api/v1 and authenticates with a personal
// access token in the X-API-Key header. Every workspace resource hangs off
// this prefix.
export const workspaceUrl = `/api/v1/workspaces/${requiredEnv('PLANE_WORKSPACE_SLUG')}`;

// The response shapes we assert on. Plane returns many more fields; listing
// only the ones the tests use keeps the types honest and short.
export type Project = {
  id: string;
  name: string;
  identifier: string;
  created_by: string;
};

export type WorkItem = {
  id: string;
  name: string;
  priority: string;
  state: string;
  project: string;
};

export type State = {
  id: string;
  name: string;
  group: string;
};

export type Comment = {
  id: string;
  comment_html: string;
  created_by: string;
};

// Every list endpoint wraps its items in this pagination envelope.
export type Page<T> = {
  results: T[];
  total_count: number;
  count: number;
};

export function newApiContext(token: string | undefined): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: requiredEnv('PLANE_BASE_URL'),
    extraHTTPHeaders: token ? { 'X-API-Key': token } : {},
  });
}

// A random suffix, so parallel workers never create the same name at the
// same millisecond (a timestamp alone did exactly that).
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

// Plane rejects hyphens in project names ("special characters"), so spaces it is.
export function uniqueName(prefix: string): string {
  return `qa ${prefix} ${randomSuffix()}`;
}

// Project identifiers must be short, uppercase, and unique per workspace.
function uniqueIdentifier(): string {
  return `QA${randomSuffix().toUpperCase()}`;
}

export async function createProject(api: APIRequestContext, name = uniqueName('project')) {
  const response = await api.post(`${workspaceUrl}/projects/`, {
    data: { name, identifier: uniqueIdentifier() },
  });
  if (!response.ok()) {
    throw new Error(`createProject failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as Project;
}

export async function deleteProject(api: APIRequestContext, projectId: string) {
  await api.delete(`${workspaceUrl}/projects/${projectId}/`);
}

export async function createWorkItem(
  api: APIRequestContext,
  projectId: string,
  data: { name: string; priority?: string; state?: string },
) {
  const response = await api.post(`${workspaceUrl}/projects/${projectId}/issues/`, { data });
  if (!response.ok()) {
    throw new Error(`createWorkItem failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as WorkItem;
}

export async function listStates(api: APIRequestContext, projectId: string) {
  const response = await api.get(`${workspaceUrl}/projects/${projectId}/states/`);
  return ((await response.json()) as Page<State>).results;
}
