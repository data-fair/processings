import '@koumoul/v-iframe/content-window'
import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin(nuxtApp => {
  window.vIframeOptions = { router: nuxtApp.$router }
})
