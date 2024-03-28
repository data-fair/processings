<template>
  <v-tooltip location="top">
    <template #activator="{ props }">
      <span
        v-bind="props"
        class="text-body-2"
      >
        <v-avatar :size="28">
          <img :src="avatarUrl">
        </v-avatar>
      </span>
    </template>
    {{ label }}
  </v-tooltip>
</template>

<script setup>
import { computed } from 'vue'

const ownerProps = defineProps({
  owner: {
    type: Object,
    default: null
  }
})

const avatarUrl = computed(() => {
  return `/simple-directory/api/avatars/${ownerProps.owner?.type}/${ownerProps.owner?.id}/avatar.png`
})

const label = computed(() => {
  let label = ownerProps.owner?.name
  if (ownerProps.owner?.role) label += ` (${ownerProps.owner?.role})`
  return label
})
</script>

<style>
</style>
