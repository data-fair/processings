<template>
  <div
    class="actions-buttons"
    style="position: absolute; right: 20px;"
  >
    <v-menu
      location="bottom left"
      :close-on-content-click="false"
    >
      <template #activator>
        <v-btn
          size="small"
          color="accent"
          class=".rounded-circle"
        >
          <v-icon>{{ icon }}</v-icon>
        </v-btn>
      </template>
      <slot name="actions" />
    </v-menu>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: 'mdi-dots-vertical' }
})
</script>

<style>
</style>
