import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

export default defineConfig({
  testDir: './tests',
  // the api and e2e tests share the state of one dev env
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // a flake must not cost a full re-run in CI
  retries: process.env.CI ? 1 : 0,
  // the json report keeps the per-test durations of the last run, used to size the smoke set
  reporter: [['dot'], ['json', { outputFile: 'dev/logs/test-timings.json' }]],
  // per test, hooks included: specs that run plugins call test.slow() (x3) instead of raising this
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT}/processings`,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'state-setup',
      testMatch: /state-setup\.ts/,
    },
    {
      name: 'unit',
      testMatch: /.*\.unit\.spec\.ts/,
      // no server, no shared state
      fullyParallel: true,
    },
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      dependencies: ['state-setup'],
    },
    {
      // Walks the heavy UI routes once so a cold Vite transforms them before
      // the specs run.
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
