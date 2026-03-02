import type { Request } from 'express'
import mongo from '#mongo'
import config from '#config'
import fs from 'node:fs/promises'

const mongoStatus = async () => { await mongo.db.command({ ping: 1 }) }
const volumeStatus = async () => {
  await fs.writeFile(`${config.dataDir}/check-access.txt`, 'ok')
}

export const getStatus = async (req: Request) =>
  runHealthChecks(req, [
    { fn: mongoStatus, name: 'mongodb' },
    { fn: volumeStatus, name: 'data volume' }
  ])

// Helper functions
const getSingleStatus = async (req: Request, fn: (req: Request) => Promise<void>, name: string) => {
  const start = performance.now()
  try {
    await fn(req)
    return {
      status: 'ok',
      name,
      timeInMs: Math.round(performance.now() - start)
    }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
      name,
      timeInMs: Math.round(performance.now() - start)
    }
  }
}
const runHealthChecks = async (
  req: Request,
  checks: Array<{ fn: (req: Request) => Promise<void>; name: string }>
) => {
  let results
  try {
    results = await Promise.all(checks.map(({ fn, name }) => getSingleStatus(req, fn, name)))
  } catch (err: any) {
    return {
      status: 'error',
      details: err.toString()
    }
  }
  const errors = results.filter(r => r.status === 'error')
  return {
    status: errors.length ? 'error' : 'ok',
    message: errors.length ? ('Problem with : ' + errors.map(s => s.name).join(', ')) : 'Service is ok',
    details: results
  }
}
