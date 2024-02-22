<template>
  <v-autocomplete
    :model-value="value"
    :items="utcs"
    :label="$t('tz')"
    :clearable="true"
    persistent-hint
    :disabled="disabled"
    menu-props="auto"
    :hint="$t('defaultTZ', { defaultTimeZone })"
    @update:model-value="$emit('update:modelValue', $event)"
    @change="$emit('change')"
  />
</template>

<script setup>
import { computed } from 'vue'
import timeZones from 'timezones.json'

const props = defineProps({
  value: String,
  disabled: Boolean
})

const utcs = computed(() => {
  const utcs = []
  timeZones.forEach(tz => {
    utcs.push(...tz.utc)
  })
  return utcs.sort()
})

const defaultTimeZone = computed(() => {
  return process.env.VUE_APP_DEFAULT_TIME_ZONE || 'UTC'
})
</script>

<i18n lang="yaml">
fr:
  tz: Fuseau horaire
  defaultTZ: Par défaut {defaultTimeZone}
en:
  tz: Time zone
  defaultTZ: Default {defaultTimeZone}
</i18n>

<style scoped>

</style>
