<template>
  <v-navigation-drawer
    class="navigation-right pl-2"
    location="right"
    permanent
    floating
    position="fixed"
    style="padding-top: 60px; background-color: transparent;"
    color="transparent"
  >
    <template #default>
      <slot />
    </template>
  </v-navigation-drawer>
</template>

<script setup>
</script>

<style scoped>
.main-logo img {
  width: 40px;
  height: auto;
}
</style>
