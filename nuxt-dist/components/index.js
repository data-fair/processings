import { wrapFunctional } from './utils'

export { default as Navigation } from '../../public/components/navigation.vue'
export { default as Notifications } from '../../public/components/notifications.vue'
export { default as ProcessingInfos } from '../../public/components/processing-infos.vue'
export { default as RemoveProcessing } from '../../public/components/remove-processing.vue'
export { default as LayoutAppBar } from '../../public/components/layout/app-bar.vue'
export { default as LayoutNavigationRight } from '../../public/components/layout/layout-navigation-right.vue'
export { default as OwnerShort } from '../../public/components/owner/owner-short.vue'
export { default as RunListItem } from '../../public/components/run/run-list-item.vue'
export { default as ProcessingActions } from '../../public/components/processing/processing-actions.vue'
export { default as ProcessingCard } from '../../public/components/processing/processing-card.vue'
export { default as ProcessingKey } from '../../public/components/processing/processing-key.vue'
export { default as ProcessingRuns } from '../../public/components/processing/processing-runs.vue'

export const LazyNavigation = import('../../public/components/navigation.vue' /* webpackChunkName: "components/navigation" */).then(c => wrapFunctional(c.default || c))
export const LazyNotifications = import('../../public/components/notifications.vue' /* webpackChunkName: "components/notifications" */).then(c => wrapFunctional(c.default || c))
export const LazyProcessingInfos = import('../../public/components/processing-infos.vue' /* webpackChunkName: "components/processing-infos" */).then(c => wrapFunctional(c.default || c))
export const LazyRemoveProcessing = import('../../public/components/remove-processing.vue' /* webpackChunkName: "components/remove-processing" */).then(c => wrapFunctional(c.default || c))
export const LazyLayoutAppBar = import('../../public/components/layout/app-bar.vue' /* webpackChunkName: "components/layout-app-bar" */).then(c => wrapFunctional(c.default || c))
export const LazyLayoutNavigationRight = import('../../public/components/layout/layout-navigation-right.vue' /* webpackChunkName: "components/layout-navigation-right" */).then(c => wrapFunctional(c.default || c))
export const LazyOwnerShort = import('../../public/components/owner/owner-short.vue' /* webpackChunkName: "components/owner-short" */).then(c => wrapFunctional(c.default || c))
export const LazyRunListItem = import('../../public/components/run/run-list-item.vue' /* webpackChunkName: "components/run-list-item" */).then(c => wrapFunctional(c.default || c))
export const LazyProcessingActions = import('../../public/components/processing/processing-actions.vue' /* webpackChunkName: "components/processing-actions" */).then(c => wrapFunctional(c.default || c))
export const LazyProcessingCard = import('../../public/components/processing/processing-card.vue' /* webpackChunkName: "components/processing-card" */).then(c => wrapFunctional(c.default || c))
export const LazyProcessingKey = import('../../public/components/processing/processing-key.vue' /* webpackChunkName: "components/processing-key" */).then(c => wrapFunctional(c.default || c))
export const LazyProcessingRuns = import('../../public/components/processing/processing-runs.vue' /* webpackChunkName: "components/processing-runs" */).then(c => wrapFunctional(c.default || c))
