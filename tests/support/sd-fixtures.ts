import { readFileSync } from 'node:fs'

/**
 * The accounts of this service's test sub-space in simple-directory: every user, organization and member
 * id (and every email) starts with the prefix, so the suite seeds and cleans them without touching the
 * accounts of other sub-spaces (dev data under another prefix, other suites).
 *
 * Upserted by tests/global-setup.ts through simple-directory's test API (POST /api/test-env/seed) before
 * the spec files are loaded (never for a unit-only run), then cleaned (DELETE /api/test-env?prefix=) and
 * seeded again by tests/state-setup.ts, under the stateful lock. Every user uses the password 'passwd' and
 * the email `<id>@test.com`, which is what the login helpers derive (tests/support/axios.ts).
 */
export const prefix = 'test_processings_'

const person = (id: string, firstName: string, lastName = '') =>
  ({ id: prefix + id, firstName, lastName, email: `${prefix}${id}@test.com`, password: { clear: 'passwd' } })

// the non human identity of the scope tests (tests/support/nhi.ts), its public key inline
const nhiJwks = JSON.parse(readFileSync(new URL('../resources/nhi/test-nhi-jwks.json', import.meta.url), 'utf8'))

export const sdFixtures = () => {
  const users = [
    // a simple-directory admin (ADMINS in docker-compose.yml)
    person('superadmin', 'Test Super', 'Admin'),
    person('admin1', 'Test Admin1'),
    person('contrib1', 'Test Contrib1'),
    person('user1', 'Test User1'),
    person('user2', 'Test User2'),
    person('dep_admin', 'Test Dep', 'Admin'),
    person('alone', 'Test Alone'),
    person('outsider', 'Test', 'Outsider'),
    {
      id: `${prefix}scope_nhi`,
      email: `${prefix}scope_nhi@test.com`,
      nhi: { provider: { issuer: 'https://processings-tests.example.com', jwks: nhiJwks }, subject: 'scope-tests' }
    }
  ]

  const organizations = [
    {
      id: `${prefix}org1`,
      name: 'Test Org 1',
      departments: [{ id: 'dep1', name: 'department 1' }, { id: 'dep2', name: 'department 2' }],
      partners: [{ id: `${prefix}org2`, name: 'Test Org 2' }],
      members: [
        { id: `${prefix}admin1`, role: 'admin' },
        { id: `${prefix}scope_nhi`, role: 'admin' },
        { id: `${prefix}user1`, role: 'user' },
        { id: `${prefix}contrib1`, role: 'contrib' },
        { id: `${prefix}dep_admin`, role: 'admin', department: 'dep1' },
        { id: `${prefix}user2`, role: 'user', department: 'dep1' }
      ]
    },
    {
      id: `${prefix}org2`,
      name: 'Test Org 2',
      members: [
        { id: `${prefix}user2`, role: 'admin' },
        { id: `${prefix}user1`, role: 'user' }
      ]
    }
  ]

  return { prefix, users, organizations }
}

/** simple-directory's test API, reached directly (not through nginx) */
export const sdTestEnvUrl = (env: Record<string, string | undefined> = process.env) => `http://localhost:${env.SD_PORT}/api/test-env`

const tooOld = 'simple-directory image too old for prefixed test sub-spaces: run "docker compose pull simple-directory"'

/**
 * POST a sub-space body to simple-directory's seed route and check the counts of the answer: an old image
 * without the prefixed test API answers 200 too, after seeding its own files, and the run would fail later with 401s.
 */
export const postSdSeed = async (url: string, body: { prefix: string, users: unknown[], organizations: unknown[] }) => {
  const seedRes = await fetch(`${url}/seed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (seedRes.status >= 500) throw new Error(`${tooOld} (HTTP ${seedRes.status} on the seed of ${body.prefix})`)
  if (seedRes.status !== 200) throw new Error(`simple-directory refused the seed of ${body.prefix}: HTTP ${seedRes.status} ${await seedRes.text()}`)
  const counts = await seedRes.json().catch(() => null) as { users: number, organizations: number } | null
  if (counts?.users !== body.users.length || counts?.organizations !== body.organizations.length) {
    throw new Error(tooOld)
  }
  return counts
}

/** Clean the sub-space in simple-directory, then seed its accounts. Idempotent. */
export const seedSdFixtures = async () => {
  const url = sdTestEnvUrl()
  const cleanRes = await fetch(`${url}?prefix=${prefix}`, { method: 'DELETE' })
  if (cleanRes.status !== 204) throw new Error(`simple-directory refused the cleanup of ${prefix}: HTTP ${cleanRes.status} ${await cleanRes.text()}`)
  return await postSdSeed(url, sdFixtures())
}
