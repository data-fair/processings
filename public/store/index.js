import Vue from 'vue'
import Vuex from 'vuex'
import { sessionStoreBuilder } from '@koumoul/sd-vue'

Vue.use(Vuex)

export default () => {
  return new Vuex.Store({
    modules: {
      session: sessionStoreBuilder(),
    },
    state: {
      embed: false,
    },
    getters: {
      embed() {
        try {
          return window.self !== window.top
        } catch (e) {
          return true
        }
      },
    },
    mutations: {
      setAny(state, params) {
        Object.assign(state, params)
      },
    },
  })
}
