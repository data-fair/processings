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
    publicPath: config.publicUrl + '/_nuxt/'
  },
  loading: { color: '#1e88e5' }, // Customize the progress bar color
  plugins: [
    { src: '~plugins/moment' },
    { src: '~plugins/session', ssr: false }
  ],
  router: {
    base: config.basePath
  },
  modules: ['@nuxtjs/axios', 'cookie-universal-nuxt'],
  axios: {
    browserBaseURL: config.basePath,
    baseURL: config.publicUrl
  },
  buildModules: ['@nuxtjs/vuetify'],
  vuetify: {
    theme: {
      themes: {
        light: {
          primary: '#1E88E5', // colors.blue.darken1
          // primary: colors.blue.lighten1, // code near our logo 'dark' blue
          accent: '#F57C00', // colors.orange.darken2
          warning: '#F57C00' // colors.orange.darken2
        },
        dark: {
          primary: '#42A5F5', // colors.blue.lighten1,
          accent: '#FF9800' // colors.orange.base
        }
      }
    }
  },
  env: {
    publicUrl: config.publicUrl,
    directoryUrl: config.directoryUrl,
    dataFairUrl: config.dataFairUrl,
    localDataFairUrl: config.localDataFairUrl
  },
  head: {
    title: 'Data Fair Processings',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'application', name: 'application-name', content: 'data-fair-processings' },
      { hid: 'description', name: 'description', content: 'Periodically import / export data between Data Fair and other services.' },
      { hid: 'robots', name: 'robots', content: 'noindex' }
    ]
  }
}
