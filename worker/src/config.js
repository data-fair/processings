import { assertValid } from '../config/type/index.js'
import config from 'config'

// we reload the config instead of using the singleton from the config module for testing purposes
// @ts-ignore
const workerConfig = process.env.NODE_ENV === 'test' ? config.util.loadFileConfigs(process.env.NODE_CONFIG_DIR_WORKER, { skipConfigSources: true }) : config
assertValid(workerConfig, 'en', 'config', true)

config.util.makeImmutable(workerConfig)

export default /** @type {import('../config/type/index.js').WorkerConfig} */(workerConfig)
