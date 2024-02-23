import { defineNuxtPlugin } from 'nuxt/app'
import '@koumoul/v-iframe/content-window.js'

export default defineNuxtPlugin(nuxtApp => {
  window.vIframeOptions = { router: nuxtApp.$router }
})
