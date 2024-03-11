<template>
  <v-autocomplete
    :model-value="value"
    :items="utcs"
    :label="t('tz')"
    :clearable="true"
    persistent-hint
    :disabled="disabled"
    menu-props="auto"
    :hint="t('defaultTZ', { defaultTimeZone })"
    @update:model-value="$emit('update:modelValue', $event)"
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

defineEmits(['update:modelValue'])
defineProps({
  disabled: Boolean,
  value: String
})

const { t } = useI18n()

const utcs = computed(() => {
  const utcs = []
  timeZones.forEach(tz => {
    utcs.push(...tz.utc)
  })
  return utcs.sort()
})

const defaultTimeZone = 'fr'
</script>

<style>
</style>
