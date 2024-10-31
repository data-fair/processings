import '@koumoul/v-iframe/content-window'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(nuxtApp => {
  globalThis.vIframeOptions = { router: nuxtApp.$router }
})
