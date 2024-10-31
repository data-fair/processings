<template>
  <v-alert
    v-if="error"
    type="error"
    density="compact"
  >
    {{ error.data || error.message || error.statusText || error }}
  </v-alert>
</template>

<script setup>

defineProps({
  error: {
    type: [Object, String],
    default: null
  }
})

</script>
