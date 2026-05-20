import path from 'node:path'
import os from 'node:os'
import type { WorkerConfig } from '../config/type/index.ts'
import { assertValid } from '../config/type/index.ts'
import config from 'config'

assertValid(config, { lang: 'en', name: 'config', internal: true })

const rawConfig = config as unknown as WorkerConfig

if (!rawConfig.tmpDir) {
  rawConfig.tmpDir = rawConfig.dataDir
    ? path.join(rawConfig.dataDir, 'tmp')
    : path.join(os.tmpdir(), 'data-fair-processings')
}

const workerConfig = rawConfig as WorkerConfig & { tmpDir: string }

// cacheDir is always a subdirectory of tmpDir.
export const registryCacheDir = path.join(workerConfig.tmpDir, 'registry-cache')

export default workerConfig
