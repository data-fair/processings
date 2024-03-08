import '@koumoul/v-iframe/content-window'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(nuxtApp => {
  window.vIframeOptions = { router: nuxtApp.$router }
})
