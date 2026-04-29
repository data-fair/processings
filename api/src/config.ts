import type { ApiConfig } from '../config/type/index.ts'
import { assertValid } from '../config/type/index.ts'
import config from 'config'

assertValid(config, { lang: 'en', name: 'config', internal: true })

const apiConfig = config as unknown as ApiConfig
export default apiConfig

export const uiConfig = {
  pluginCategories: apiConfig.pluginCategories,
}
export type UiConfig = typeof uiConfig
