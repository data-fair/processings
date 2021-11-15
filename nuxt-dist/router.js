import Vue from 'vue'
import Router from 'vue-router'
import { normalizeURL, decode } from 'ufo'
import { interopDefault } from './utils'
import scrollBehavior from './router.scrollBehavior.js'

const _20ace5c3 = () => interopDefault(import('../public/pages/processings/index.vue' /* webpackChunkName: "pages/processings/index" */))
const _0765ea60 = () => interopDefault(import('../public/pages/admin/plugins.vue' /* webpackChunkName: "pages/admin/plugins" */))
const _42a1062a = () => interopDefault(import('../public/pages/processings/_id.vue' /* webpackChunkName: "pages/processings/_id" */))
const _88eb38ba = () => interopDefault(import('../public/pages/runs/_id.vue' /* webpackChunkName: "pages/runs/_id" */))
const _9ef38d5c = () => interopDefault(import('../public/pages/index.vue' /* webpackChunkName: "pages/index" */))

const emptyFn = () => {}

Vue.use(Router)

export const routerOptions = {
  mode: 'history',
  base: '/',
  linkActiveClass: 'nuxt-link-active',
  linkExactActiveClass: 'nuxt-link-exact-active',
  scrollBehavior,

  routes: [{
    path: "/processings",
    component: _20ace5c3,
    name: "processings"
  }, {
    path: "/admin/plugins",
    component: _0765ea60,
    name: "admin-plugins"
  }, {
    path: "/processings/:id",
    component: _42a1062a,
    name: "processings-id"
  }, {
    path: "/runs/:id?",
    component: _88eb38ba,
    name: "runs-id"
  }, {
    path: "/",
    component: _9ef38d5c,
    name: "index"
  }],

  fallback: false
}

export function createRouter (ssrContext, config) {
  const base = (config._app && config._app.basePath) || routerOptions.base
  const router = new Router({ ...routerOptions, base  })

  // TODO: remove in Nuxt 3
  const originalPush = router.push
  router.push = function push (location, onComplete = emptyFn, onAbort) {
    return originalPush.call(this, location, onComplete, onAbort)
  }

  const resolve = router.resolve.bind(router)
  router.resolve = (to, current, append) => {
    if (typeof to === 'string') {
      to = normalizeURL(to)
    }
    return resolve(to, current, append)
  }

  return router
}
