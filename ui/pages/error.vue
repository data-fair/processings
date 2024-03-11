<template>
  <div class="container">
    <v-alert
      type="error"
    >
      {{ error.message }}
    </v-alert>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const error = ref({
  statusCode: 500,
  message: 'Unknown error'
})

onMounted(() => {
  const params = new URLSearchParams(location.search)
  if (!params.has('statusCode') && !params.has('message')) {
    navigateTo({ path: '/' })
  }
  const state = {
    statusCode: 401,
    message: 'Authentification nécessaire'
  }
  if (params.has('statusCode')) {
    state.statusCode = params.get('statusCode')
  }
  if (params.has('message')) {
    state.message = params.get('message')
  }
  error.value = { ...state }
  history.replaceState({}, document.title, location.pathname)
})
</script>
