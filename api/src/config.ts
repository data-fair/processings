import path from 'node:path'
import os from 'node:os'
import type { ApiConfig } from '../config/type/index.ts'
import { assertValid } from '../config/type/index.ts'
import config from 'config'

assertValid(config, { lang: 'en', name: 'config', internal: true })

const rawConfig = config as unknown as ApiConfig

if (!rawConfig.tmpDir) {
  rawConfig.tmpDir = rawConfig.dataDir
    ? path.join(rawConfig.dataDir, 'tmp')
    : path.join(os.tmpdir(), 'data-fair-processings')
}

const apiConfig = rawConfig as ApiConfig & { tmpDir: string }

// cacheDir is always a subdirectory of tmpDir.
export const registryCacheDir = path.join(apiConfig.tmpDir, 'registry-cache')

export default apiConfig

export const uiConfig = {
  pluginCategories: apiConfig.pluginCategories
}
export type UiConfig = typeof uiConfig
