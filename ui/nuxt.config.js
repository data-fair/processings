import * as baseConfig from './config/default'
import * as devConfig from './config/development'
import nuxtConfigInject from '@koumoul/nuxt-config-inject'
import { defineNuxtConfig } from 'nuxt/config'
import { URL } from 'url'

let config = { ...baseConfig.default }
if (process.env.NODE_ENV === 'development') {
  config = { ...config, ...devConfig.default }
}
config.basePath = new URL(config.publicUrl + '/').pathname
const dataFairIsLocal = new URL(config.publicUrl).origin === new URL(config.dataFairUrl).origin
config.localDataFairUrl = dataFairIsLocal ? config.dataFairUrl : config.publicUrl + '/data-fair-proxy'

const isBuilding = process.argv.slice(-1)[0] === 'build'

if (process.env.NODE_ENV === 'production') {
  if (isBuilding) config = nuxtConfigInject.prepare(config)
  else nuxtConfigInject.replace(config, ['nuxt-dist/**/*', 'static/**/*'])
}

export default defineNuxtConfig({
  telemetry: false,
  ssr: false,
  srcDir: './',
  buildDir: 'nuxt-dist',
  build: {
    // always the same url to fetch static resource, even in multi-domain mode
    publicPath: config.publicUrl + '/_nuxt/',
    transpile: ['@koumoul', '@data-fair']
  },
  loading: { color: '#1e88e5' },
  devtools: {
    enabled: true,
    timeline: {
      enabled: true
    }
  },
  plugins: [
    { src: 'plugins/dayjs' },
    { src: 'plugins/filters' },
    { src: 'plugins/session', ssr: false },
    { src: 'plugins/v-iframe', ssr: false },
    { src: 'plugins/ws', ssr: false }
  ],
  router: {
    base: config.basePath
  },
  modules: [
    '@nuxtjs/google-fonts',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    'vuetify-nuxt-module'
  ],
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
  vuetify: {
    moduleOptions: {
      styles: { configFile: './assets/variables.scss' }
    },
    vuetifyOptions: './vuetify.config.js'
  },
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
  meta: {
    title: 'Data Fair Processings',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'application', name: 'application-name', content: 'data-fair-processings' },
      { hid: 'description', name: 'description', content: 'Periodically import / export data between Data Fair and other services.' },
      { hid: 'robots', name: 'robots', content: 'noindex' }
    ]
  },
  css: [
    '@mdi/font/css/materialdesignicons.min.css',
    './assets/variables.scss'
  ]
})
