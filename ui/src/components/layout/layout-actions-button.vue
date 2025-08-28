<template>
  <v-fab
    size="small"
    color="primary"
    location="top right"
    app
    icon
  >
    <v-icon
      :icon="mdiDotsVertical"
    />
    <v-menu
      activator="parent"
      :close-on-content-click="false"
    >
      <v-card max-width="300">
        <slot />
      </v-card>
    </v-menu>
  </v-fab>
</template>
