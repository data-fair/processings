import type { WorkerConfig } from '../config/type/index.ts'
import { assertValid } from '../config/type/index.ts'
import config from 'config'

// we reload the config instead of using the singleton from the config module for testing purposes
// @ts-ignore
const workerConfig = process.env.NODE_ENV === 'test' ? config.util.loadFileConfigs(process.env.NODE_CONFIG_DIR, { skipConfigSources: true }) : config
assertValid(workerConfig, { lang: 'en', name: 'config', internal: true })

config.util.makeImmutable(workerConfig)

export default workerConfig as WorkerConfig
