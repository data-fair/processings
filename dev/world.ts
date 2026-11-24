/**
 * Seed the dev world in simple-directory: the accounts of the sub-space test_demo_ (dev/resources/demo-world.json),
 * the developer account test_demo_dev@example.org (password passwd, a simple-directory admin), its organization
 * test_demo_org, a contributor of it and an outsider. The tests never clean this sub-space.
 *
 * Run by npm run dev-deps once the containers are up, or alone: npm run dev-world
 * Idempotent (POST /api/test-env/seed upserts the accounts), it never deletes anything.
 * Configured by the environment (SD_PORT), .env completes it when present.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { postSdSeed, sdTestEnvUrl } from '../tests/support/sd-fixtures.ts'

const demoWorld = JSON.parse(readFileSync(new URL('./resources/demo-world.json', import.meta.url), 'utf8'))

if (!process.env.SD_PORT) throw new Error('SD_PORT is not defined (environment or .env)')
const url = sdTestEnvUrl()

// simple-directory's port can open a little before its routes answer
for (let attempt = 1; ; attempt++) {
  try {
    const ping = await fetch(`${url}/ping`)
    if (ping.ok) break
    throw new Error(`HTTP ${ping.status}, the container needs ENABLE_TEST_API=1`)
  } catch (err) {
    if (attempt >= 30) throw new Error(`simple-directory's test API is unavailable at ${url}: ${(err as Error).message}`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

const counts = await postSdSeed(url, demoWorld)
console.log(`dev world ${demoWorld.prefix} seeded in simple-directory: ${counts.users} user(s), ${counts.organizations} organization(s), login ${demoWorld.users[0].email} / passwd`)
