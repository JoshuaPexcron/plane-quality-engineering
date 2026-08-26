// Prepares a Plane instance for the test suite: workspaces, the member and
// guest accounts, and API tokens. Writes the results into .env so the tests
// can read them. Safe to run repeatedly: every step tolerates finding its
// work already done.
//
// Run: node scripts/seed.ts   (needs PLANE_BASE_URL, PLANE_ADMIN_EMAIL,
// PLANE_ADMIN_PASSWORD in the environment or in .env)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { requiredEnv } from '../lib/env.ts';

try {
  process.loadEnvFile();
} catch {
  // no .env yet, fine on a fresh CI runner
}

const BASE = process.env.PLANE_BASE_URL ?? 'http://localhost';
const WORKSPACE = { name: 'QA Workspace', slug: 'qa-workspace' };
const OTHER_WORKSPACE = { name: 'QA Other', slug: 'qa-other' };
const MEMBER_EMAIL = process.env.PLANE_MEMBER_EMAIL ?? 'qa-member@example.com';
const GUEST_EMAIL = process.env.PLANE_GUEST_EMAIL ?? 'qa-guest@example.com';
const TEST_PASSWORD = process.env.PLANE_TEST_PASSWORD ?? 'Qa-Plane-2026-m4T!';
const TOKEN_LABEL = 'qa-tests';
const ROLE = { member: 15, guest: 5 };

// One logged-in user = one request context; it keeps the session cookies.
type Session = { api: APIRequestContext; headers: Record<string, string> };

async function newSession(): Promise<Session> {
  const api = await request.newContext({ baseURL: BASE });
  const { csrf_token } = await (await api.get('/auth/get-csrf-token/')).json();
  // Django wants the CSRF token as header and form field, plus a matching Referer.
  return { api, headers: { 'X-CSRFToken': csrf_token, Referer: `${BASE}/` } };
}

// Sign-in and sign-up answer with a redirect on success and on failure alike;
// the failure only shows up as ?error_code=... in the final URL.
async function authForm(session: Session, path: string, email: string, password: string) {
  const response = await session.api.post(path, {
    headers: session.headers,
    form: { csrfmiddlewaretoken: session.headers['X-CSRFToken'], email, password },
  });
  const errorCode = new URL(response.url()).searchParams.get('error_code');
  if (errorCode) throw new Error(`${path} failed for ${email}: ${errorCode}`);
}

async function signIn(email: string, password: string): Promise<Session> {
  const session = await newSession();
  await authForm(session, '/auth/sign-in/', email, password);
  return session;
}

// Sign up, or sign in when the account already exists (re-runs).
async function signUpOrIn(email: string, password: string): Promise<Session> {
  const session = await newSession();
  try {
    await authForm(session, '/auth/sign-up/', email, password);
  } catch (error) {
    if (!String(error).includes('USER_ALREADY_EXIST')) throw error;
    await authForm(session, '/auth/sign-in/', email, password);
  }
  return session;
}

// Fails with the status and body on error; tolerates empty bodies (204).
async function json<T>(response: APIResponse): Promise<T> {
  const text = await response.text();
  if (!response.ok()) throw new Error(`${response.url()} -> ${response.status()} ${text}`);
  return text ? JSON.parse(text) : undefined;
}

async function ensureWorkspace(admin: Session, workspace: { name: string; slug: string }) {
  const mine = await json<{ slug: string }[]>(await admin.api.get('/api/users/me/workspaces/'));
  if (mine.some((w) => w.slug === workspace.slug)) return;
  await json(
    await admin.api.post('/api/workspaces/', {
      headers: admin.headers,
      data: { ...workspace, organization_size: '2-10' },
    }),
  );
  console.log(`created workspace ${workspace.slug}`);
}

// A fresh account lands in the onboarding wizard on every UI login. Marking
// onboarding done makes logins land in the workspace instead.
async function markOnboarded(session: Session) {
  await json(
    await session.api.patch('/api/users/me/onboard/', {
      headers: session.headers,
      data: { is_onboarded: true },
    }),
  );
}

// The invitation email is only a notification. The invitation itself is a
// record that a logged-in user with the matching email can accept in-app, so
// no mail server is needed.
async function ensureMember(admin: Session, slug: string, email: string, role: number) {
  const members = await json<{ member: { email: string } }[]>(
    await admin.api.get(`/api/workspaces/${slug}/members/`),
  );
  if (members.some((m) => m.member.email === email)) {
    console.log(`${email} is already a member`);
    return;
  }
  await json(
    await admin.api.post(`/api/workspaces/${slug}/invitations/`, {
      headers: admin.headers,
      data: { emails: [{ email, role }] },
    }),
  );

  const user = await signUpOrIn(email, TEST_PASSWORD);
  const invitations = await json<{ id: string }[]>(
    await user.api.get('/api/users/me/workspaces/invitations/'),
  );
  await json(
    await user.api.post('/api/users/me/workspaces/invitations/', {
      headers: user.headers,
      data: { invitations: invitations.map((i) => i.id) },
    }),
  );
  await json(
    await user.api.patch('/api/users/me/', {
      headers: user.headers,
      data: { first_name: 'QA', last_name: role === ROLE.member ? 'Member' : 'Guest' },
    }),
  );
  await markOnboarded(user);
  await user.api.dispose();
  console.log(`${email} joined ${slug} with role ${role}`);
}

// Tokens are only readable at creation, so a re-run replaces the old one.
async function createToken(session: Session): Promise<string> {
  const existing = await json<{ id: string; label: string }[]>(
    await session.api.get('/api/users/api-tokens/'),
  );
  for (const token of existing.filter((t) => t.label === TOKEN_LABEL)) {
    await session.api.delete(`/api/users/api-tokens/${token.id}/`, { headers: session.headers });
  }
  const created = await json<{ token: string }>(
    await session.api.post('/api/users/api-tokens/', {
      headers: session.headers,
      data: { label: TOKEN_LABEL, description: 'created by scripts/seed.ts', never_expires: true },
    }),
  );
  return created.token;
}

// Merge the seeded values into .env, keeping whatever else is in there.
function writeEnv(values: Record<string, string>) {
  const lines = existsSync('.env') ? readFileSync('.env', 'utf8').split('\n') : [];
  const kept = lines.filter((line) => !Object.keys(values).some((k) => line.startsWith(`${k}=`)));
  const added = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  writeFileSync('.env', [...kept.filter(Boolean), ...added].join('\n') + '\n');
}

// --- run ---
const admin = await signIn(requiredEnv('PLANE_ADMIN_EMAIL'), requiredEnv('PLANE_ADMIN_PASSWORD'));
await markOnboarded(admin);

// Reuse the admin's first workspace when one exists (local instance), else
// create one (fresh CI instance).
const workspaces = await json<{ slug: string }[]>(await admin.api.get('/api/users/me/workspaces/'));
const slug = workspaces.find((w) => w.slug !== OTHER_WORKSPACE.slug)?.slug ?? WORKSPACE.slug;
await ensureWorkspace(admin, { ...WORKSPACE, slug });
await ensureWorkspace(admin, OTHER_WORKSPACE);

await ensureMember(admin, slug, MEMBER_EMAIL, ROLE.member);
await ensureMember(admin, slug, GUEST_EMAIL, ROLE.guest);

const adminToken = await createToken(admin);
const member = await signIn(MEMBER_EMAIL, TEST_PASSWORD);
const memberToken = await createToken(member);
await member.api.dispose();
await admin.api.dispose();

writeEnv({
  PLANE_WORKSPACE_SLUG: slug,
  PLANE_OTHER_WORKSPACE_SLUG: OTHER_WORKSPACE.slug,
  PLANE_API_TOKEN: adminToken,
  PLANE_MEMBER_API_TOKEN: memberToken,
  PLANE_MEMBER_EMAIL: MEMBER_EMAIL,
  PLANE_GUEST_EMAIL: GUEST_EMAIL,
  PLANE_TEST_PASSWORD: TEST_PASSWORD,
});
console.log(`seed done: workspace ${slug}, tokens written to .env`);
