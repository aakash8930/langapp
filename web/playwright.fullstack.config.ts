import { defineConfig, devices } from '@playwright/test';

const apiURL = 'http://127.0.0.1:3000';
const webURL = 'http://127.0.0.1:4174';

export default defineConfig({
  testDir: './e2e-fullstack',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: webURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run seed --silent && npm run start',
      cwd: '../api',
      url: `${apiURL}/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174',
      cwd: '.',
      url: webURL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: { ...process.env, VITE_API_URL: apiURL },
    },
  ],
});
