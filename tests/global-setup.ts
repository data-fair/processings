import 'dotenv/config'
import { postSdSeed, sdFixtures, sdTestEnvUrl } from './support/sd-fixtures.ts'

/**
 * The projects named on the command line (--project=x or --project x), none meaning all of them.
 */
const selectedProjects = (argv = process.argv): string[] => {
  const projects: string[] = []
  argv.forEach((arg, i) => {
    if (arg.startsWith('--project=')) projects.push(arg.slice('--project='.length))
    else if (arg === '--project' && argv[i + 1]) projects.push(argv[i + 1])
  })
  return projects
}

/**
 * Upsert the test accounts (test_processings_, tests/support/sd-fixtures.ts) in simple-directory before the spec
 * files are loaded: many of them log in at import time, which playwright does before running any project
 * (state-setup included).
 *
 * Never destructive: it runs outside the stateful lock (tests/support/stateful-lock.ts), so a run started
 * while another one is going must not delete what that one uses. The cleanup of the sub-space in
 * simple-directory is done by tests/state-setup.ts, under the lock.
 *
 * A unit-only run touches nothing. When simple-directory does not answer at all, the seed is skipped and
 * the api and e2e projects fail in state-setup, which explains what is missing.
 */
export default async function globalSetup () {
  const projects = selectedProjects()
  if (projects.length && projects.every(project => project === 'unit')) return
  try {
    const ping = await fetch(`${sdTestEnvUrl()}/ping`)
    if (!ping.ok) {
      console.log(`simple-directory test API answers HTTP ${ping.status} at ${sdTestEnvUrl()}, test accounts not seeded`)
      return
    }
  } catch {
    console.log(`simple-directory is not reachable at ${sdTestEnvUrl()}, test accounts not seeded`)
    return
  }
  await postSdSeed(sdTestEnvUrl(), sdFixtures())
}
