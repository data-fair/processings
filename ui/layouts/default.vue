<template>
  <div class="v-app">
    <v-app>
      <LayoutAppBar v-if="dev()" />
      <v-main>
        <NuxtPage />
        <Notifications />
      </v-main>
    </v-app>
  </div>
</template>

<script setup>
import 'iframe-resizer/js/iframeResizer.contentWindow'

globalThis.iFrameResizer = {
  heightCalculationMethod: 'taggedElement'
}

const dev = () => {
  try {
    return !(window.self !== window.top)
  } catch (e) {
    return true
  }
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

<style scoped>
:deep(.v-input .v-input__details) {
  display: none;
}
</style>
