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
import { onMounted, toRefs } from 'vue'

const props = defineProps({
  error: Object
})

const { error } = toRefs(props)

onMounted(() => {
  const params = new URLSearchParams(location.search)
  history.replaceState({}, document.title, location.pathname)
  const state = {}
  if (!params.has('statusCode')) {
    state.statusCode = 401
  } else {
    state.statusCode = params.get('statusCode')
  }
  if (!params.has('message')) {
    state.message = 'Authentification nécessaire'
  } else {
    state.message = params.get('message')
  }
  error.value = { ...state }
})
</script>
