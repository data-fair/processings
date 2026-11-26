import assert from 'node:assert/strict'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { test as setup } from '@playwright/test'
import { takeStatefulLock } from './support/stateful-lock.ts'
import { prefix, sdTestEnvUrl, seedSdFixtures } from './support/sd-fixtures.ts'
import { apiUrl, clean } from './support/axios.ts'
import { cleanDataFairDatasets, setupWorkerApiKey } from './support/data-fair.ts'

const ax = axiosBuilder()

setup('Stateful tests setup', async () => {
  // FIRST, before anything touches the database: a second run must be refused before its first
  // clean() can delete what the running one just seeded. See tests/support/stateful-lock.ts.
  takeStatefulLock()

  // Check that the dev API server is up
  await assert.doesNotReject(
    ax.get(`${apiUrl}/api/v1/test-env/pending-tasks`, { params: { prefix } }),
    `Dev API server seems to be unavailable at ${apiUrl}.
If you are an agent, do not try to start it: read its logs (dev/logs/api.log, or DEV_LOG_DIR) and report the problem to your user.`
  )

  // the accounts of the test sub-space (test_processings_) in simple-directory, under the lock: cleaned (what
  // a previous run left), then seeded again. tests/global-setup.ts only upserted them, for the specs that
  // log in at import time.
  await assert.doesNotReject(ax.get(`${sdTestEnvUrl()}/ping`),
    `simple-directory's test API is unavailable at ${sdTestEnvUrl()}: the container needs ENABLE_TEST_API=1 and STORAGE_TYPE=mongo (docker-compose.yml).`)
  await seedSdFixtures()

  // what the sub-space left here from a previous run
  await clean()

  // and the datasets its runs left in data-fair
  await cleanDataFairDatasets()

  // the worker's data-fair API key, created through data-fair's API and handed to the worker
  await setupWorkerApiKey()
})
