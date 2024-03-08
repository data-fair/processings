import * as baseConfig from './config/default'
import * as devConfig from './config/development'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { commonjsDeps } from '@koumoul/vjsf/utils/build.js'
import { defineNuxtConfig } from 'nuxt/config'
import { URL } from 'url'

let config = { ...baseConfig.default }
if (process.env.NODE_ENV === 'development') {
  config = { ...config, ...devConfig.default }
}
config.basePath = new URL(config.publicUrl + '/').pathname
const dataFairIsLocal = new URL(config.publicUrl).origin === new URL(config.dataFairUrl).origin
config.localDataFairUrl = dataFairIsLocal ? config.dataFairUrl : config.publicUrl + '/data-fair-proxy'

if (process.env.NODE_ENV === 'production') {
  process.env.NUXT_CONFIG = JSON.stringify(config)
}

export default defineNuxtConfig({
  app: {
    baseURL: config.basePath
  },
  build: {
    transpile: ['@koumoul', '@data-fair', 'vuetify']
  },
  css: [
    '@mdi/font/css/materialdesignicons.min.css',
    './assets/main.scss'
  ],
  // Force enabling the dev tools on nuxi dev as the shortcut (Shift + Alt + D) is not working on non QWERTY keyboards, see https://github.com/nuxt/devtools/issues/601
  devtools: {
    enabled: true,
    timeline: {
      enabled: true
    }
  },
  modules: [
    ['@nuxtjs/google-fonts', {
      display: 'swap',
      families: { Nunito: true }
    }],
    ['@nuxtjs/i18n', {
      locales: ['fr', 'en'],
      defaultLocale: config.i18nDefaultLocale,
      strategy: 'no_prefix',
      detectBrowserLanguage: {
        useCookie: true,
        cookieKey: 'i18n_lang'
      }
    }],
    '@pinia/nuxt',
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({
          autoImport: true,
          styles: {
            configFile: './assets/settings.scss'
          }
        }))
      })
    }
  ],
  plugins: [
    { src: 'plugins/filters' },
    { src: 'plugins/session', mode: 'client' },
    { src: 'plugins/v-iframe', mode: 'client' },
    { src: 'plugins/vuetify' },
    { src: 'plugins/ws', mode: 'client' }
  ],
  port: 3039,
  runtimeConfig: {
    public: {
      mainPublicUrl: config.publicUrl,
      basePath: config.basePath,
      directoryUrl: config.directoryUrl,
      dataFairUrl: config.dataFairUrl,
      dataFairAdminMode: config.dataFairAdminMode,
      notifyUrl: config.notifyUrl,
      datasetsUrlTemplate: config.datasetsUrlTemplate,
      defaultTimeZone: config.defaultTimeZone
    }
  },
  // Avoids getting "WARN Sourcemap for "x" points to missing source files", see https://github.com/nuxt/nuxt/issues/14124#issuecomment-1517258360
  sourcemap: {
    client: false,
    server: true
  },
  ssr: false,
  telemetry: false,
  vite: {
    build: {
      commonjsOptions: {
        include: commonjsDeps
      }
    },
    optimizeDeps: {
      include: commonjsDeps
    },
    vue: {
      template: {
        transformAssetUrls
      }
    }
  }
})
