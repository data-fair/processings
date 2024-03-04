<template>
  <p />
</template>

<script setup>
import { onMounted } from 'vue'
import { useStore } from '~/store/index'

const store = useStore()

onMounted(() => {
  store.setBreadcrumbs([])
})
</script>

<style>
</style>
