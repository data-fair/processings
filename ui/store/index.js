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
        const parentBreadcrumb = breadcrumbs.map(b => {
          const newB = { text: b.title }
          if (b.href !== undefined) {
            newB.to = b.href
          }
          newB.exact = true
          return newB
        })
        globalThis.parent.postMessage({ parentBreadcrumb }, '*')
      }
    }
  }
}

const storeDefinition = sessionPiniaStoreBuilder(extension)

export const useStore = storeDefinition

export default useStore
