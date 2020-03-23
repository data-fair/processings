import Vue from 'vue'
import Vuex from 'vuex'
import { sessionStoreBuilder } from '@koumoul/sd-vue'

Vue.use(Vuex)

export default () => {
  return new Vuex.Store({
    modules: {
      session: sessionStoreBuilder()
    },
    state: {
      embed: false
    },
    getters: {
      activeAccount(state) {
        const user = state.session && state.session.user
        if (!user) return null
        if (user.organization) {
          return {
            type: 'organization',
            key: 'organization:' + user.organization.id,
            id: user.organization.id,
            name: user.organization.name
          }
        } else {
          return {
            type: 'user',
            key: 'user:' + user.id,
            id: user.id,
            name: user.name
          }
        }
      }
    },
    mutations: {
      setAny(state, params) {
        Object.assign(state, params)
      }
    },
    async nuxtServerInit({ commit, dispatch }, { req, env, app, route }) {
      commit('setAny', { embed: route.query.embed === 'true' })
    }
  })
}
