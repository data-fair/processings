<template>
  <v-toolbar-items class="lang-switcher">
    <v-menu>
      <template #activator="{ props }">
        <v-btn
          variant="flat"
          color="transparent"
          v-bind="props"
          style="height: 100% !important; border-radius: 0;"
        >
          {{ currentLocale }}
        </v-btn>
      </template>

      <v-list>
        <v-list-item
          v-for="filteredLocale in filteredLocales"
          :key="filteredLocale"
          @click="setLocale(filteredLocale)"
        >
          <v-list-item-title>{{ filteredLocale }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-toolbar-items>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locales } = defineProps({
  locales: { type: Array, default: () => ['fr', 'en'] }
})

const { locale, setLocale: setI18nLocale } = useI18n()
const currentLocale = computed(() => locale.value)

const filteredLocales = computed(() => {
  return locales.filter(l => l !== locale.value)
})

function setLocale(locale) {
  setI18nLocale(locale)
  window.location.reload()
}
</script>

<style>
</style>
