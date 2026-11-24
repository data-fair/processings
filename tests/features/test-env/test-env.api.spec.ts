import { test, expect } from '../../fixtures/login.ts'
import { anonymousAx, apiUrl, clean } from '../../support/axios.ts'

const status = { validateStatus: () => true }
const invalidPrefixes = ['', 'test', 'test_', 'test_processings', 'other_x_', 'test_.*_']

// through nginx, like the world loader of a dev environment of several services, which cleans each one
test.describe('test-env clean', () => {
  test('the clean and the pending tasks need a valid test prefix', async () => {
    for (const route of ['delete', 'get'] as const) {
      const url = route === 'delete' ? '/api/v1/test-env' : '/api/v1/test-env/pending-tasks'
      expect((await anonymousAx[route](url, status)).status, route).toBe(400)
      for (const prefix of invalidPrefixes) {
        expect((await anonymousAx[route](url, { ...status, params: { prefix } })).status, `${route} ${prefix}`).toBe(400)
      }
    }
  })

  test('the clean of a prefix removes what its accounts own, and only that', async () => {
    // three nested sub-spaces of the suite's own: their accounts need not exist in simple-directory
    const subSpaces = ['test_processings_cleana_', 'test_processings_cleanb_', 'test_processings_cleanz_']
    const owned = (sub: string) => [
      ['processings', `${sub}processing`],
      ['runs', `${sub}run`],
      ['limits', `${sub}limit`],
      // the worker locks a run by the id of its processing
      ['locks', `${sub}processing`]
    ]
    const count = async (sub: string) => {
      let n = 0
      for (const [collection, id] of owned(sub)) {
        if ((await anonymousAx.get(`/api/v1/test-env/docs/${collection}/${encodeURIComponent(id)}`, status)).status === 200) n++
      }
      return n
    }
    try {
      for (const sub of subSpaces) {
        const owner = { type: 'user', id: `${sub}user`, name: 'Clean test' }
        await anonymousAx.post('/api/v1/test-env/docs/processings', { _id: `${sub}processing`, title: 'Clean test', owner })
        await anonymousAx.post('/api/v1/test-env/docs/runs', { _id: `${sub}run`, status: 'finished', processing: { _id: `${sub}processing`, title: 'Clean test' }, owner })
        await anonymousAx.post('/api/v1/test-env/docs/limits', { _id: `${sub}limit`, type: 'user', id: `${sub}user`, name: 'Clean test' })
        await anonymousAx.post('/api/v1/test-env/docs/locks', { _id: `${sub}processing`, origin: 'clean-test' })
        expect(await count(sub)).toBe(4)
      }

      expect((await anonymousAx.delete('/api/v1/test-env', { ...status, params: { prefix: 'test_processings_cleana_' } })).status).toBe(204)
      expect(await count('test_processings_cleana_')).toBe(0)
      expect(await count('test_processings_cleanb_')).toBe(4)
      expect(await count('test_processings_cleanz_')).toBe(4)

      expect((await anonymousAx.delete('/api/v1/test-env', { ...status, params: { prefix: 'test_processings_cleanb_' } })).status).toBe(204)
      expect(await count('test_processings_cleanb_')).toBe(0)
      expect(await count('test_processings_cleanz_')).toBe(4)
    } finally {
      // the suite's own clean covers the three
      await clean()
    }
    for (const sub of subSpaces) expect(await count(sub)).toBe(0)
  })

  test('the pending tasks of a prefix are only its own', async () => {
    const subSpaces = ['test_processings_pendinga_', 'test_processings_pendingb_']
    try {
      for (const sub of subSpaces) {
        // scheduled: the worker leaves a run alone until its date
        await anonymousAx.post('/api/v1/test-env/docs/runs', {
          _id: `${sub}run`,
          status: 'scheduled',
          scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
          processing: { _id: `${sub}processing`, title: 'Pending test' },
          owner: { type: 'user', id: `${sub}user`, name: 'Pending test' }
        })
      }
      const pending = (await anonymousAx.get('/api/v1/test-env/pending-tasks', { params: { prefix: 'test_processings_pendinga_' } })).data
      expect(pending.scheduled.map((r: any) => r._id)).toEqual(['test_processings_pendinga_run'])
    } finally {
      await clean()
    }
  })
})

// The runtime overrides of the API process answer only the suite's own test run: a direct call (no proxy) while its
// stateful lock is held. This run holds it (state-setup).
test.describe('test-env runtime overrides', () => {
  test('refused through the proxy', async () => {
    for (const route of ['set-env', 'set-config']) {
      const res = await anonymousAx.post(`/api/v1/test-env/${route}`, {}, status)
      expect(res.status, route).toBe(403)
    }
  })

  test('accepted from the suite\'s own run', async () => {
    const res = await anonymousAx.post(`${apiUrl}/api/v1/test-env/set-env`, { key: 'PROCESSINGS_TEST_ENV_PROBE', value: '1' }, status)
    expect(res.status).toBe(200)
    expect((await anonymousAx.post(`${apiUrl}/api/v1/test-env/set-env`, { key: 'PROCESSINGS_TEST_ENV_PROBE', value: null }, status)).status).toBe(200)
  })
})
