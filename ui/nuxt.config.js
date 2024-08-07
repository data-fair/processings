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

  runtimeConfig: {
    public: {
      // overwrite using NUXT_PUBLIC_DATA_FAIR_ADMIN_MODE env var
      dataFairAdminMode: false
    }
  },

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
        const vuetifyPluginConfig = {}
        // building components styles in dev mode is too slow
        // comment the "if" to see the customized styles in dev mode
        if (process.env.NODE_ENV !== 'development') {
          vuetifyPluginConfig.styles = { configFile: new URL('assets/settings.scss', import.meta.url).pathname }
        }
        config.plugins?.push(vuetify(vuetifyPluginConfig))
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
