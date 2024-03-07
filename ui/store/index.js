import { sessionPiniaStoreBuilder } from './pinia'

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
      this.breadcrumbs = breadcrumbs
      if (globalThis.parent) {
        globalThis.parent.postMessage({ breadcrumbs }, '*')
      }
    }
  }
}

const storeDefinition = sessionPiniaStoreBuilder(extension)

export const useStore = storeDefinition

export default useStore
