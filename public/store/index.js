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
      },
      canContrib (state, getters) {
        const activeAccount = getters['session/activeAccount']
        if (!activeAccount) return false
        if (activeAccount.adminMode) return true
        if (activeAccount.type === 'user') return true
        const role = state.session.user.organization.role
        return role === process.env.adminRole || role === process.env.contribRole
      },
      canAdmin (state, getters) {
        const activeAccount = getters['session/activeAccount']
        if (!activeAccount) return false
        if (activeAccount.adminMode) return true
        if (activeAccount.type === 'user') return true
        const role = state.session.user.organization.role
        return role === process.env.adminRole
      }
    },
    mutations: {
      setAny (state, params) {
        Object.assign(state, params)
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
}
