import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { clean } from '../../support/axios.ts'

// The legacy plugins directory and the registry cache of the dev api and worker (dataDir ../data/development) are
// shared by every sub-space of the environment: the suite's clean removes only the entries of its own plugins.
const dataDir = path.resolve(import.meta.dirname, '../../../data/development')
const pluginsDir = path.join(dataDir, 'plugins')
const cacheDir = path.join(dataDir, 'tmp/registry-cache')

test.describe('test-env clean of files', () => {
  test('clean removes only the plugin directories and cache entries of its prefix', async () => {
    const entries = {
      ownPlugin: path.join(pluginsDir, '@test_processings_clean-files-1'),
      otherPlugin: path.join(pluginsDir, '@data-fair-processing-other-1'),
      ownCache: path.join(cacheDir, '@test_processings_clean-files-1'),
      otherCache: path.join(cacheDir, '@test_other_clean-files-1')
    }
    for (const dir of Object.values(entries)) {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'marker'), 'x')
    }
    try {
      await clean()
      expect(fs.existsSync(entries.ownPlugin)).toBe(false)
      expect(fs.existsSync(entries.ownCache)).toBe(false)
      expect(fs.existsSync(path.join(entries.otherPlugin, 'marker'))).toBe(true)
      expect(fs.existsSync(path.join(entries.otherCache, 'marker'))).toBe(true)
    } finally {
      fs.rmSync(entries.otherPlugin, { recursive: true, force: true })
      fs.rmSync(entries.otherCache, { recursive: true, force: true })
    }
  })

  test('the plugins clean needs a valid test prefix', async () => {
    const { anonymousAx, apiUrl } = await import('../../support/axios.ts')
    const status = { validateStatus: () => true }
    expect((await anonymousAx.delete(`${apiUrl}/api/v1/test-env/plugins`, status)).status).toBe(400)
    expect((await anonymousAx.delete(`${apiUrl}/api/v1/test-env/plugins`, { ...status, params: { prefix: 'test_' } })).status).toBe(400)
  })
})
