<template>
  <v-navigation-drawer
    location="right"
    class="pt-12"
    permanent
    floating
    style="background-color: transparent;"
  >
    <template #default>
      <slot />
    </template>
  </v-navigation-drawer>
</template>
