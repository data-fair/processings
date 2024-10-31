<template>
  <v-app>
    <LayoutAppBar v-if="!embed" />
    <v-main>
      <RouterView />
      <notifications />
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
</script>
