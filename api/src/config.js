import { assertValid } from '../config/type/index.js'
import config from 'config'

// we reload the config instead of using the singleton from the config module for testing purposes
// @ts-ignore
const apiConfig = process.env.NODE_ENV === 'test' ? config.util.loadFileConfigs(process.env.NODE_CONFIG_DIR, { skipConfigSources: true }) : config
assertValid(apiConfig, 'en', 'config', true)

config.util.makeImmutable(apiConfig)

export default /** @type {import('../config/type/index.js').ApiConfig} */(apiConfig)
