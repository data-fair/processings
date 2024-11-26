<template>
  <div />
</template>

<script setup lang="ts">
// Foolproof routing
const router = useRouter()
onMounted(() => {
  router.push('/admin/plugins')
})
</script>
