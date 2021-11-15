import Vue from 'vue'
import { wrapFunctional } from './utils'

const components = {
  Navigation: () => import('../../public/components/navigation.vue' /* webpackChunkName: "components/navigation" */).then(c => wrapFunctional(c.default || c)),
  Notifications: () => import('../../public/components/notifications.vue' /* webpackChunkName: "components/notifications" */).then(c => wrapFunctional(c.default || c)),
  ProcessingInfos: () => import('../../public/components/processing-infos.vue' /* webpackChunkName: "components/processing-infos" */).then(c => wrapFunctional(c.default || c)),
  RemoveProcessing: () => import('../../public/components/remove-processing.vue' /* webpackChunkName: "components/remove-processing" */).then(c => wrapFunctional(c.default || c)),
  LayoutAppBar: () => import('../../public/components/layout/app-bar.vue' /* webpackChunkName: "components/layout-app-bar" */).then(c => wrapFunctional(c.default || c)),
  LayoutNavigationRight: () => import('../../public/components/layout/layout-navigation-right.vue' /* webpackChunkName: "components/layout-navigation-right" */).then(c => wrapFunctional(c.default || c)),
  OwnerShort: () => import('../../public/components/owner/owner-short.vue' /* webpackChunkName: "components/owner-short" */).then(c => wrapFunctional(c.default || c)),
  RunListItem: () => import('../../public/components/run/run-list-item.vue' /* webpackChunkName: "components/run-list-item" */).then(c => wrapFunctional(c.default || c)),
  ProcessingActions: () => import('../../public/components/processing/processing-actions.vue' /* webpackChunkName: "components/processing-actions" */).then(c => wrapFunctional(c.default || c)),
  ProcessingCard: () => import('../../public/components/processing/processing-card.vue' /* webpackChunkName: "components/processing-card" */).then(c => wrapFunctional(c.default || c)),
  ProcessingKey: () => import('../../public/components/processing/processing-key.vue' /* webpackChunkName: "components/processing-key" */).then(c => wrapFunctional(c.default || c)),
  ProcessingRuns: () => import('../../public/components/processing/processing-runs.vue' /* webpackChunkName: "components/processing-runs" */).then(c => wrapFunctional(c.default || c))
}

for (const name in components) {
  Vue.component(name, components[name])
  Vue.component('Lazy' + name, components[name])
}
