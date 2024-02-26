import { sessionPiniaStoreBuilder } from '../../../sd-vue/src/index'

const extension = {
  state: () => ({
    embed: false,
    breadcrumbs: null,
    env: null,
    runBackLink: false
  }),
  getters: {
    getEmbed() {
      try {
        return window.self !== window.top
      } catch (e) {
        return true
      }
    }
  },
  actions: {
    setBreadcrumbs(breadcrumbs) {
      breadcrumbs.forEach(b => { b.exact = true })
      this.setAny(breadcrumbs)
    }
  }
}

const storeDefinition = sessionPiniaStoreBuilder(extension)

export const useStore = storeDefinition

export default useStore
