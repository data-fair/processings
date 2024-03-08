<template>
  <div />
</template>

<script setup>
import { onMounted } from 'vue'

// Foolproof routing
onMounted(() => {
  navigateTo('/admin/plugins')
})
</script>
