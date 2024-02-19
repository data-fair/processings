export { default as Navigation } from '../../components/navigation.vue'
export { default as Notifications } from '../../components/notifications.vue'
export { default as PrivateAccess } from '../../components/private-access.vue'
export { default as ProcessingInfos } from '../../components/processing-infos.vue'
export { default as ProcessingsActions } from '../../components/processings-actions.vue'
export { default as RemoveProcessing } from '../../components/remove-processing.vue'
export { default as TimeZoneSelect } from '../../components/time-zone-select.vue'
export { default as LayoutAppBar } from '../../components/layout/app-bar.vue'
export { default as LayoutActionsButton } from '../../components/layout/layout-actions-button.vue'
export { default as LayoutNavigationRight } from '../../components/layout/layout-navigation-right.vue'
export { default as OwnerShort } from '../../components/owner/owner-short.vue'
export { default as ProcessingActions } from '../../components/processing/processing-actions.vue'
export { default as ProcessingCard } from '../../components/processing/processing-card.vue'
export { default as ProcessingKey } from '../../components/processing/processing-key.vue'
export { default as ProcessingRuns } from '../../components/processing/processing-runs.vue'
export { default as RunListItem } from '../../components/run/run-list-item.vue'
export { default as RunLogsList } from '../../components/run/run-logs-list.vue'

// nuxt/nuxt.js#8607
function wrapFunctional(options) {
  if (!options || !options.functional) {
    return options
  }

  const propKeys = Array.isArray(options.props) ? options.props : Object.keys(options.props || {})

  return {
    render(h) {
      const attrs = {}
      const props = {}

      for (const key in this.$attrs) {
        if (propKeys.includes(key)) {
          props[key] = this.$attrs[key]
        } else {
          attrs[key] = this.$attrs[key]
        }
      }

      return h(options, {
        on: this.$listeners,
        attrs,
        props,
        scopedSlots: this.$scopedSlots,
      }, this.$slots.default)
    }
  }
}
