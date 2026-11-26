/**
 * One stateful test run at a time against the dev environment.
 *
 * The api and e2e projects share one database, and every spec starts with `clean()`, which deletes every
 * object of the test sub-space `test_processings_` (processings, runs, limits). Playwright
 * serialises tests WITHIN a run (`workers: 1`), but nothing stops a SECOND run: its `clean()` would land in
 * the middle of the first run's tests and delete what they just seeded, failures that change from run to
 * run and never reproduce alone. So a second run is refused, loudly and immediately.
 *
 * Taken by the `state-setup` project, so only runs that touch the database take it: a unit-only run
 * neither needs it nor waits for it.
 */
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

/** Under dev/logs, which Playwright does not wipe — `test-results/` is cleared at the start of every
 * run, so a lock there would be deleted by exactly the run it is meant to stop. */
export const LOCK_PATH = 'dev/logs/stateful-tests.lock'

/**
 * The Playwright runner's pid: setup and teardown run in WORKER processes, whose parent is the runner,
 * and the runner lives exactly as long as the run. A lock left by a killed run therefore names a dead
 * process and is taken over rather than blocking forever.
 */
const runnerPid = (): number => process.ppid

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (err: any) {
    // EPERM: it exists but belongs to someone else — still alive, still a run in progress.
    return err?.code === 'EPERM'
  }
}

export function takeStatefulLock (): void {
  const owner = runnerPid()
  // dev/logs only exists once a process logged there: a fresh checkout whose dev processes log elsewhere
  // (DEV_LOG_DIR) has none
  mkdirSync(dirname(LOCK_PATH), { recursive: true })
  // Twice at most: the second attempt follows clearing a STALE lock, and a race lost there means a
  // live run took it in between — which is exactly the case to refuse.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // `wx` is create-exclusive: two runs racing for the lock cannot both succeed.
      const fd = openSync(LOCK_PATH, 'wx')
      writeSync(fd, `${owner}\n`)
      closeSync(fd)
      return
    } catch (err: any) {
      if (err?.code !== 'EEXIST') throw err
      const holder = parseInt(readFileSync(LOCK_PATH, 'utf8'), 10)
      if (holder && holder !== owner && isAlive(holder)) {
        throw new Error(
          `Another stateful test run (Playwright pid ${holder}) is using the dev database.\n` +
          'Two runs wipe each other\'s data — every spec\'s clean() deletes all test_processings_ objects — which ' +
          'produces failures that change from run to run and never reproduce alone.\n' +
          `Wait for it to finish, or stop it. If no run is active, delete ${LOCK_PATH}.\n` +
          'If you are an agent: do not start a test run while one you launched earlier is still going.'
        )
      }
      // Stale: its run is gone (killed, crashed), or it is this run's own from a retried setup.
      rmSync(LOCK_PATH, { force: true })
    }
  }
  throw new Error(`could not take ${LOCK_PATH}: another run took it at the same moment`)
}

export function releaseStatefulLock (): void {
  try {
    // Only our own: a teardown must never release a lock a different run now holds.
    if (parseInt(readFileSync(LOCK_PATH, 'utf8'), 10) === runnerPid()) rmSync(LOCK_PATH, { force: true })
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err
  }
}
