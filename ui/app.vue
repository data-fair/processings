<template>
  <v-app>
    <LayoutAppBar v-if="!embed" />
    <v-main>
      <NuxtPage />
      <Notifications />
    </v-main>
  </v-app>
</template>

<script setup>
const embed = (() => {
  try {
    return window.self !== window.top
  } catch (e) {
    return true
  }
})()

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
