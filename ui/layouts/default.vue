<template>
  <v-app :theme="isDark ? 'dark' : 'light'">
    <ClientOnly><AppBar v-if="!embed" /></ClientOnly>
    <v-main class="v-app">
      <NuxtPage />
      <Notifications />
    </v-main>
  </v-app>
</template>

<script setup>
import 'iframe-resizer/js/iframeResizer.contentWindow'
import Notifications from '~/components/notifications.vue'
import AppBar from '~/components/layout/app-bar.vue'
import { computed } from 'vue'
import { useStore } from '~/store/index'

const store = useStore()
const theme = useTheme()
const isDark = computed(() => theme.dark)

const embed = computed(() => store.embed)

globalThis.iFrameResizer = {
  heightCalculationMethod: 'taggedElement'
}

useHead({
  title: 'Data Fair Processings',
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { hid: 'application', name: 'application-name', content: 'data-fair-processings' },
    { hid: 'description', name: 'description', content: 'Periodically import / export data between Data Fair and other services.' },
    { hid: 'robots', name: 'robots', content: 'noindex' }
  ]
})
</script>

<components :AppBar="AppBar" :Notifications="Notifications" />

<style lang="scss">
@import '~/assets/main.scss';

.v-list.list-actions .v-list-item .v-list-item__icon {
  margin-right: 16px;
}
</style>
