import * as baseConfig from './config/default'
import * as devConfig from './config/development'
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
    transpile: ['@koumoul', '@data-fair']
  },
  buildDir: 'nuxt-dist',
  css: [
    '@mdi/font/css/materialdesignicons.min.css',
    './assets/main.scss'
  ],
  devtools: {
    enabled: true,
    timeline: {
      enabled: true
    }
  },
  googleFonts: {
    preconnect: true,
    preload: true,
    display: 'swap',
    download: true,
    inject: true,
    families: {
      Nunito: [100, 300, 400, 500, 700, 900]
    }
  },
  i18n: {
    locales: ['en', 'fr'],
    defaultLocale: config.i18n.defaultLocale,
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_lang'
    },
    vueI18n: './i18n.config.js'
  },
  modules: [
    '@nuxtjs/google-fonts',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    'vuetify-nuxt-module'
  ],
  plugins: [
    { src: 'plugins/filters' },
    { src: 'plugins/pinia' },
    { src: 'plugins/session', mode: 'client' },
    { src: 'plugins/v-iframe', mode: 'client' },
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
      adminRole: config.adminRole,
      contribRole: config.contribRole,
      defaultTimeZone: config.defaultTimeZone
    }
  },
  srcDir: './',
  ssr: false,
  telemetry: false,
  vuetify: {
    moduleOptions: {
      styles: {
        configFile: './assets/settings.scss'
      }
    },
    vuetifyOptions: './vuetify.config.js'
  }
})
