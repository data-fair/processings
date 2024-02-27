<template>
  <div class="actions-buttons" style="position: absolute; right: 20px;">
    <v-menu bottom left :close-on-content-click="false">
      <template #activator>
        <v-btn fab small color="accent">
          <v-icon>{{ icon }}</v-icon>
        </v-btn>
      </template>
      <slot name="actions"></slot>
    </v-menu>
  </div>
</template>

<script setup>
const props = defineProps({
  icon: { type: String, default: 'mdi-dots-vertical' }
})
</script>

<style scoped>
</style>
