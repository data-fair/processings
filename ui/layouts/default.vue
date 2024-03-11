<template>
  <div class="v-app">
    <v-app>
      <v-main>
        <NuxtPage />
        <Notifications />
      </v-main>
    </v-app>
  </div>
</template>

<script setup>
import 'iframe-resizer/js/iframeResizer.contentWindow'
import Notifications from '~/components/notifications.vue'

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

<components :Notifications="Notifications" />

<style>
</style>
