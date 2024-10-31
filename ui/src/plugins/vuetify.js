import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { defaultOptions } from '@data-fair/lib/vuetify.js'
import useReactiveSearchParams from '@data-fair/lib/vue/reactive-search-params.js'
import { defineNuxtPlugin, useCookie } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const reactiveSearchParams = useReactiveSearchParams()
  const cookie = useCookie('theme_dark', { watch: false })
  const options = defaultOptions(reactiveSearchParams, (cookie.value + '') === 'true')
  const vuetify = createVuetify(options)
  nuxtApp.vueApp.use(vuetify)
})
