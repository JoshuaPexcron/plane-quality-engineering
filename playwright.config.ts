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
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.PLANE_BASE_URL ?? 'http://localhost',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
