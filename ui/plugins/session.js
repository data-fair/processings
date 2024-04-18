import { createSession } from '@data-fair/lib/vue/session.js'
import { defineNuxtPlugin, useRoute } from '#app'

export default defineNuxtPlugin(async (nuxtApp) => {
  nuxtApp.vueApp.use(await createSession({ req: nuxtApp.ssrContext?.event.node.req, route: useRoute() }))
})
