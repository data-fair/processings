<template>
  <div
    class="actions-buttons mt-4"
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

<style scoped>
.actions-buttons {
  z-index: 1000;
  position: fixed;
  right: 20px;
}
</style>
