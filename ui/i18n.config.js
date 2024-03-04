import * as baseConfig from './config/default'
import * as devConfig from './config/development'

let config = { ...baseConfig.default }
if (process.env.NODE_ENV === 'development') {
  config = { ...config, ...devConfig.default }
}

export default defineI18nConfig(() => ({
  fallbackLocale: config.i18n.defaultLocale
}))
