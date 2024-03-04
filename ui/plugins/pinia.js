import { defineNuxtPlugin } from 'nuxt/app'
import { useStore } from '~/store/index'

export default defineNuxtPlugin(({ $pinia }) => {
  return {
    provide: {
      store: useStore($pinia)
    }
  }
})
