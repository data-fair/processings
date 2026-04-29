import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { test as setup } from '@playwright/test'
import { apiUrl } from './support/axios.ts'

const ax = axiosBuilder()

setup('Stateful tests setup', async () => {
  // Check that the dev API server is up
  await assert.doesNotReject(
    ax.get(`${apiUrl}/api/v1/test-env/pending-tasks`),
    `Dev API server seems to be unavailable at ${apiUrl}.
If you are an agent do not try to start it. Instead check for a startup failure at the end of dev/logs/dev-api.log and report this problem to your user.`
  )

  // More visible dev server logs straight in the test output
  try {
    const { existsSync, mkdirSync } = await import('node:fs')
    if (!existsSync('dev/logs')) mkdirSync('dev/logs', { recursive: true })
    const tailApi = spawn('tail', ['-n', '0', '-f', 'dev/logs/dev-api.log'], { stdio: 'inherit', detached: true })
    const tailWorker = spawn('tail', ['-n', '0', '-f', 'dev/logs/dev-worker.log'], { stdio: 'inherit', detached: true })
    process.env.TAIL_PIDS = [tailApi.pid, tailWorker.pid].filter(Boolean).join(',')
  } catch {
    // log tailing is optional
  }
})
