import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'dot',
  timeout: 60_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT1}/processings`,
    actionTimeout: 5_000,
    navigationTimeout: 5_000,
  },

  projects: [
    {
      name: 'state-setup',
      testMatch: /state-setup\.ts/,
      teardown: 'state-teardown'
    },
    {
      name: 'state-teardown',
      testMatch: /state-teardown\.ts/,
    },
    {
      name: 'unit',
      testMatch: /.*\.unit\.spec\.ts/,
    },
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      dependencies: ['state-setup'],
    },
    {
      // Walks the heavy UI routes once so Vite finishes optimizing its lazy
      // deps before the specs run — a mid-test re-optimization forces a full
      // page reload and fails a random spec on a timeout.
      name: 'e2e-warmup',
      testMatch: /e2e-warmup\.ts/,
      dependencies: ['state-setup'],
      timeout: 180_000,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e',
      testMatch: /.*\.e2e\.spec\.ts/,
      dependencies: ['e2e-warmup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
