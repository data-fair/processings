const URL = require('url').URL
let config = { ...require('config') }
config.basePath = new URL(config.publicUrl + '/').pathname
const dataFairIsLocal = new URL(config.publicUrl).origin === new URL(config.dataFairUrl).origin
config.localDataFairUrl = dataFairIsLocal ? config.dataFairUrl : config.publicUrl + '/data-fair-proxy'

if (process.env.NODE_ENV === 'production') {
  const nuxtConfigInject = require('@koumoul/nuxt-config-inject')
  if (process.argv.slice(-1)[0] === 'build') config = nuxtConfigInject.prepare(config)
  else nuxtConfigInject.replace(config)
}

module.exports = {
  mode: 'spa',
  srcDir: 'public/',
  build: {
    transpile: ['@koumoul/vjsf'],
    publicPath: config.publicUrl + '/_nuxt/',
  },
  loading: { color: '#1e88e5' }, // Customize the progress bar color
  plugins: [
    { src: '~plugins/filters' },
    { src: '~plugins/moment' },
    { src: '~plugins/typography' },
    { src: '~plugins/session', ssr: false },
  ],
  router: {
    base: config.basePath,
  },
  modules: ['@nuxtjs/axios', 'cookie-universal-nuxt'],
  axios: {
    browserBaseURL: config.basePath,
    baseURL: config.publicUrl,
  },
  buildModules: ['@nuxtjs/vuetify'],
  vuetify: {
    defaultAssets: {
      font: {
        family: 'Nunito',
      },
    },
    icons: {
      iconfont: 'mdi',
    },
    theme: {
      themes: {
        light: {
          primary: '#1E88E5', // blue.darken1
          secondary: '#42A5F5', // blue.lighten1,
          accent: '#FF9800', // orange.base
          error: 'FF5252', // red.accent2
          info: '#2196F3', // blue.base
          success: '#4CAF50', // green.base
          warning: '#E91E63', // pink.base
          admin: '#E53935', // red.darken1
        },
        dark: {
          primary: '#2196F3', // blue.base
          secondary: '#42A5F5', // blue.lighten1,
          accent: '#FF9800', // orange.base
          error: 'FF5252', // red.accent2
          info: '#2196F3', // blue.base
          success: '#00E676', // green.accent3
          warning: '#E91E63', // pink.base
          admin: '#E53935', // red.darken1
        },
      },
    },
  },
  env: {
    publicUrl: config.publicUrl,
    directoryUrl: config.directoryUrl,
    dataFairUrl: config.dataFairUrl,
    localDataFairUrl: config.localDataFairUrl,
    datasetsUrlTemplate: config.datasetsUrlTemplate,
  },
  head: {
    title: 'Data Fair Processings',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'application', name: 'application-name', content: 'data-fair-processings' },
      { hid: 'description', name: 'description', content: 'Periodically import / export data between Data Fair and other services.' },
      { hid: 'robots', name: 'robots', content: 'noindex' },
    ],
  },
}
