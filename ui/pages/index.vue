<template>
  <p />
</template>

<script setup>
import { onMounted } from 'vue'
import { useStore } from '../store/index.js'

const store = useStore()

onMounted(() => {
  store.setBreadcrumbs([])
})
</script>

<style scoped>
</style>
