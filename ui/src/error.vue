<template>
  <v-container>
    <v-alert
      type="error"
    >
      {{ error.message }}
    </v-alert>
  </v-container>
</template>

<script setup>
defineProps({
  error: {
    type: Object,
    required: true
  }
})
</script>
