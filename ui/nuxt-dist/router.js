import Vue from 'vue'
import Router from 'vue-router'
import { normalizeURL, decode } from 'ufo'
import { interopDefault } from './utils'
import scrollBehavior from './router.scrollBehavior.js'

const _3a662de8 = () => interopDefault(import('../pages/processings/index.vue' /* webpackChunkName: "pages/processings/index" */))
const _1a94fa29 = () => interopDefault(import('../pages/admin/plugins.vue' /* webpackChunkName: "pages/admin/plugins" */))
const _6062221b = () => interopDefault(import('../pages/index.vue' /* webpackChunkName: "pages/index" */))
const _3b4c8318 = () => interopDefault(import('../pages/processings/_id.vue' /* webpackChunkName: "pages/processings/_id" */))
const _b8be4b8c = () => interopDefault(import('../pages/runs/_id.vue' /* webpackChunkName: "pages/runs/_id" */))

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
    component: _3a662de8,
    name: "processings"
  }, {
    path: "/admin/plugins",
    component: _1a94fa29,
    name: "admin-plugins"
  }, {
    path: "/",
    component: _6062221b,
    name: "index"
  }, {
    path: "/processings/:id",
    component: _3b4c8318,
    name: "processings-id"
  }, {
    path: "/runs/:id?",
    component: _b8be4b8c,
    name: "runs-id"
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
