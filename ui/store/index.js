import { createPinia } from 'pinia'
import { sessionPiniaStoreBuilder } from '@data-fair/sd-vue'

Vue.use(createPinia())

export const useStore = sessionPiniaStoreBuilder().$patch({
  state: {
    embed: false,
    breadcrumbs: null,
    env: null,
    runBackLink: false
  },
  getters: {
    embed () {
      try {
        return window.self !== window.top
      } catch (e) {
        return true
      }
    }
  },
  actions: {
    setBreadcrumbs ({ commit }, breadcrumbs) {
      breadcrumbs.forEach(b => { b.exact = true })
      commit('setAny', { breadcrumbs })
      if (global.parent) parent.postMessage({ breadcrumbs }, '*')
    }
  }
})

export default useStore
