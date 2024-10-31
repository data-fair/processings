import { createReactiveSearchParams } from '@data-fair/lib/vue/reactive-search-params.js'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((app) => {
  app.vueApp.use(createReactiveSearchParams())
})
