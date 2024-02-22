<template>
  <v-app>
    <client-only><app-bar v-if="!embed" /></client-only>
    <v-main>
      <nuxt-child />
      <notifications />
    </v-main>
  </v-app>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '../store/index.js'
import 'iframe-resizer/js/iframeResizer.contentWindow'
import Notifications from '../components/notifications.vue'
import AppBar from '~/components/layout/app-bar.vue'

const store = useStore()

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
