import { sessionPiniaStoreBuilder } from '../../../sd-vue/src/index'

const extension = {
  state: () => ({
    embed: false,
    breadcrumbs: null,
    env: null,
    runBackLink: false
  }),
  mutations: {},
  getters: {
    getEmbed () {
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
}

const storeDefinition = sessionPiniaStoreBuilder(extension)

export const useStore = storeDefinition

export default useStore
