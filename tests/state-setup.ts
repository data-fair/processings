import assert from 'node:assert/strict'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { test as setup } from '@playwright/test'
import { apiUrl } from './support/axios.ts'
import { seedDataFairApiKey } from './support/data-fair.ts'

const ax = axiosBuilder()

setup('Stateful tests setup', async () => {
  // Check that the dev API server is up
  await assert.doesNotReject(
    ax.get(`${apiUrl}/api/v1/test-env/pending-tasks`),
    `Dev API server seems to be unavailable at ${apiUrl}.
If you are an agent, do not try to start it: read its logs (dev/logs/api.log, or DEV_LOG_DIR) and report the problem to your user.`
  )

  // Seed an admin-mode API key in data-fair's mongo so the worker can talk
  // to data-fair on behalf of any test owner. Idempotent.
  await seedDataFairApiKey()
})
