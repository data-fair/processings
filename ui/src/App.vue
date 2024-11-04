<template>
  <v-app>
    <layout-app-bar v-if="!embed" />
    <v-main>
      <RouterView />
      <ui-notif />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import uiNotif from '@data-fair/lib-vuetify/ui-notif.vue'

const embed = (() => {
  try {
    return window.self !== window.top
  } catch (e) {
    return true
  }
})()
</script>
