<template style="margin:0;padding:0">
  <v-app :theme="isDark ? 'dark' : 'light'">
    <ClientOnly><AppBar v-if="!embed" /></ClientOnly>
    <v-main>
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
</script>

<components :AppBar="AppBar" :Notifications="Notifications" />

<style>
.v-list.list-actions .v-list-item .v-list-item__icon {
  margin-right: 16px;
}
</style>
