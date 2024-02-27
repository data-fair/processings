import * as baseConfig from './config/default'
import * as devConfig from './config/development'
import { defineVuetifyConfiguration } from 'vuetify-nuxt-module/custom-configuration'

let config = { ...baseConfig.default }
if (process.env.NODE_ENV === 'development') {
  config = { ...config, ...devConfig.default }
}
let vuetifyOptions = {}

if (process.env.NODE_ENV !== 'production' || isBuilding) {
  vuetifyOptions = {
    locale: {
      locale: 'fr',
      fallback: 'en'
    },
    localeMessages: ['en', 'fr'],
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          dark: false,
          colors: {
            primary: '#1E88E5', // blue.darken1
            secondary: '#42A5F5', // blue.lighten1,
            accent: '#FF9800', // orange.base
            error: 'FF5252', // red.accent2
            info: '#2196F3', // blue.base
            success: '#4CAF50', // green.base
            warning: '#E91E63', // pink.base
            admin: '#E53935' // red.darken1
          }
        },
        dark: {
          dark: true,
          colors: {
            primary: '#2196F3', // blue.base
            secondary: '#42A5F5', // blue.lighten1,
            accent: '#FF9800', // orange.base
            error: 'FF5252', // red.accent2
            info: '#2196F3', // blue.base
            success: '#00E676', // green.accent3
            warning: '#E91E63', // pink.base
            admin: '#E53935' // red.darken1
          }
        }
      }
    }
  }
}

export default defineVuetifyConfiguration({
  ...vuetifyOptions
})
