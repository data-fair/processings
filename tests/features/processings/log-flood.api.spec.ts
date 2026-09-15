import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { axiosAuth, clean, waitForRunStatus } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

const buildLogFloodTarball = (): string => {
  const fixtureDir = path.resolve(import.meta.dirname, '../../fixtures/processing-log-flood')
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-flood-pack-'))
  execSync('npm pack --pack-destination ' + outDir, { cwd: fixtureDir, stdio: 'pipe' })
  const tarball = fs.readdirSync(outDir).find(f => f.endsWith('.tgz'))
  if (!tarball) throw new Error('npm pack did not produce a tarball')
  return path.join(outDir, tarball)
}

// Worker default (worker/config/default.mjs). The fixture writes 20 000 chars
// per entry, so every entry is truncated to maxLogEntryLength.
const maxLogEntryLength = 10000
const mongoDocumentLimit = 16 * 1024 * 1024

test.describe('run log size guard', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('a task flooding its log is failed once the run document is full', async () => {
    test.setTimeout(300_000)
    const superadmin = await axiosAuth('test_superadmin@test.com')

    const plugin = await publishFixturePlugin({
      name: '@data-fair-tests/processing-log-flood',
      version: '1.0.0',
      tarballPath: buildLogFloodTarball()
    })
    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Log flood test',
      plugin: plugin.pluginId,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
      active: true,
      config: {}
    })).data
    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    const finalRun = await waitForRunStatus(triggered._id, ['finished', 'error'], 270_000)
    expect(finalRun.status).toBe('error')

    const log = finalRun.log as Array<{ type: string, msg: string }>
    // the loop of the fixture never completes
    expect(log.map(l => l.msg)).not.toContain('log-flood fixture finished, the guard did not trigger')
    // every flooding entry was truncated
    const flooding = log.filter(l => l.msg.startsWith('xxxx'))
    expect(flooding.length).toBeGreaterThan(0)
    for (const entry of flooding) expect(entry.msg).toBe('x'.repeat(maxLogEntryLength) + '...')
    // the document filled up, the log was truncated to make room for the guard message and finish()
    expect(log.some(l => l.type === 'error' && /taille maximale/.test(l.msg))).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(log))).toBeLessThan(mongoDocumentLimit / 4)
    expect(log[log.length - 1].type).toBe('debug') // finish() could still add its entry
  })
})
