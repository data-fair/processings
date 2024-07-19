import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { commonjsDeps } from '@koumoul/vjsf/utils/build.js'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  app: {
    baseURL: '/processings/'
  },

  build: {
    // transpile: [/@koumoul/, /@data-fair/, /vuetify/]
    transpile: ['@data-fair/lib']
  },
  css: ['@/assets/main.scss'],

  // Force enabling the dev tools on nuxi dev as the shortcut (Shift + Alt + D) is not working on non QWERTY keyboards, see https://github.com/nuxt/devtools/issues/601
  /* devtools: {
    enabled: true,
    timeline: {
      enabled: true
    }
  }, */
  modules: [
    ['@nuxtjs/google-fonts', {
      display: 'swap',
      families: { Nunito: true }
    }],
    ['@nuxtjs/i18n', {
      locales: ['fr', 'en'],
      defaultLocale: 'fr',
      strategy: 'no_prefix',
      detectBrowserLanguage: {
        useCookie: true,
        cookieKey: 'i18n_lang'
      }
    }],
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({
          autoImport: true,
          styles: { configFile: new URL('assets/settings.scss', import.meta.url).pathname }
        }))
      })
    }
  ],

  plugins: [
    { src: 'plugins/session', mode: 'client' },
    { src: 'plugins/reactive-search-params' },
    { src: 'plugins/v-iframe', mode: 'client' },
    { src: 'plugins/vuetify' },
    { src: 'plugins/ws', mode: 'client' }
  ],

  // Avoids getting "WARN Sourcemap for "x" points to missing source files", see https://github.com/nuxt/nuxt/issues/14124#issuecomment-1517258360
  sourcemap: {
    client: false,
    server: true
  },

  ssr: false,
  telemetry: false,

  vite: {
    optimizeDeps: {
      include: commonjsDeps
    },
    vue: {
      template: {
        transformAssetUrls
      }
    }
  },
  compatibilityDate: '2024-07-19'
})
