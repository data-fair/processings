<template>
  <v-autocomplete
    :value="value"
    :items="utcs"
    :label="$t('tz')"
    :clearable="true"
    persistent-hint
    :disabled="disabled"
    menu-props="auto"
    :hint="$t('defaultTZ', {defaultTimeZone})"
    @input="v => $emit('input', v)"
    @change="$emit('change')"
  />
</template>

<i18n lang="yaml">
fr:
  tz: Fuseau horaire
  defaultTZ: Par défaut {defaultTimeZone}
en:
  tz: Time zone
</i18n>

<script>
const timeZones = require('timezones.json')

export default {
  props: ['value', 'disabled'],
  data () {
    return { timeZones }
  },
  computed: {
    utcs () {
      const utcs = []
      for (const tz of timeZones) {
        for (const utc of tz.utc) utcs.push(utc)
      }
      return utcs
    },
    defaultTimeZone () {
      return process.env.defaultTimeZone
    }
  }
}
</script>

<style>

</style>
