<template>
  <div
    class="actions-buttons"
    style="position: absolute; right: 20px;"
  >
    <v-menu
      location="bottom left"
      :close-on-content-click="false"
    >
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          size="small"
          color="primary"
          icon="mdi-dots-vertical"
        />
      </template>
      <slot name="actions" />
    </v-menu>
  </div>
</template>

<script setup>
</script>

<style>
</style>
