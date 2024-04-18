<template>
  <v-autocomplete
    :model-value="value"
    :items="utcs"
    :label="t('tz')"
    :clearable="true"
    persistent-hint
    :hint="t('defaultTZ', { defaultTimeZone })"
    @update:model-value="propagateEvent($event)"
  />
</template>

<i18n lang="yaml">
fr:
  tz: Fuseau horaire
  defaultTZ: Par défaut {defaultTimeZone}
en:
  tz: Time zone
  defaultTZ: Default {defaultTimeZone}
</i18n>

<script setup>
import timeZones from 'timezones.json'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits(['tzchange'])
defineProps({
  value: {
    type: String,
    default: 'Europe/Paris'
  }
})

const { t } = useI18n()

const utcs = computed(() => {
  /** @type {string[]} */
  const utcs = []
  timeZones.forEach(tz => {
    utcs.push(...tz.utc)
  })
  return utcs.sort()
})

const defaultTimeZone = 'Europe/Paris'

/**
 * @param {string} newValue
 */
function propagateEvent(newValue) {
  emit('tzchange', newValue)
}
</script>

<style>
</style>
