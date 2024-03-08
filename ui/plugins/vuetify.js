import '@mdi/font/css/materialdesignicons.min.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { defineNuxtPlugin, useCookie } from '#app'
import { en, fr } from 'vuetify/locale'
import { useRoute } from 'vue-router'
import { useStore } from '~/store/index'
import { computed, watch } from 'vue'

export default defineNuxtPlugin((nuxtApp) => {
  const route = useRoute()
  const themeCookie = useCookie('theme_dark')
  const store = useStore()
  const storeVuetify = computed(() => store.vuetify)
  const vuetify = createVuetify({
    locale: {
      locale: 'fr',
      fallback: 'en',
      messages: { en, fr }
    },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          dark: false,
          colors: {
            primary: '#1E88E5', // blue.darken1
            secondary: '#42A5F5', // blue.lighten1
            accent: '#FF9800', // orange.base
            error: 'FF5252', // red.accent2
            info: '#2196F3', // blue.base
            success: '#4CAF50', // green.base
            warning: '#E91E63', // pink.base
            admin: '#E53935' // red.darken1
          },
          variables: {
            'hover-opacity': 0.04,
            'overlay-multiplier': 1
          }
        },
        dark: {
          dark: true,
          colors: {
            primary: '#2196F3', // blue.base
            secondary: '#42A5F5', // blue.lighten1
            accent: '#FF9800', // orange.base
            error: 'FF5252', // red.accent2
            info: '#2196F3', // blue.base
            success: '#00E676', // green.accent3
            warning: '#E91E63', // pink.base
            admin: '#E53935' // red.darken1
          },
          variables: {
            'hover-opacity': 0.04,
            'overlay-multiplier': 1
          }
        }
      }
    }
  })
  store.setAny({ vuetify })

  if (themeCookie.value !== undefined) {
    // @ts-ignore : themeCookie.value is a boolean
    storeVuetify.value.theme.global.name = themeCookie.value === true ? 'dark' : 'light'
  }

  if (route.query.dark) {
    // @ts-ignore : themeCookie.value is a boolean
    storeVuetify.value.theme.global.name = themeCookie.value === true ? 'dark' : 'light'
  }
  nuxtApp.vueApp.use(vuetify)
  nuxtApp.$vuetify = vuetify

  // Change the used vuetify instance when the store's vuetify changes
  watch(() => store.vuetify, vuetify => {
    nuxtApp.vueApp.use(vuetify)
    nuxtApp.vueApp.provide('vuetify', vuetify)
  })
})
