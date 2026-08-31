import { defineConfig, devices } from '@playwright/test';

// Load .env (Node 20.12+ has this built in — no dotenv dependency needed).
// In CI there is no .env file; variables come from the workflow instead.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — fine in CI
}

export default defineConfig({
  testDir: './tests',
  retries: process.env.CI ? 1 : 0,
  // Four browsers plus the whole Plane stack on one machine starve each
  // other (40s request freezes, killed gunicorn workers); two is what the
  // instance serves reliably, locally and in CI.
  workers: 2,
  // Plane on a shared machine is slow at auth redirects and full-page
  // loads; whole-flow tests and single assertions need more room than
  // Playwright's defaults (30s test, 5s expect).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.PLANE_BASE_URL ?? 'http://localhost',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      // Signs in each role once and saves the storage states the ui project uses.
      name: 'setup',
      testDir: './tests/setup',
      testMatch: '**/*.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      dependencies: ['setup'],
      // Most UI tests run as admin; tests that need another role (or none)
      // override this per file with test.use().
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
    },
  ],
});
