<template>
  <div class="container">
    <NuxtLayout name="default">
      <v-alert
        v-if="error.statusCode !== 401"
        type="error"
      >
        {{ error.message }}
      </v-alert>
    </NuxtLayout>
  </div>
</template>

<script setup>
import { onMounted, toRefs } from 'vue'
import { useStore } from '~/store/index'

const props = defineProps({
  error: Object
})

const { error } = toRefs(props)

const store = useStore()

onMounted(() => {
  if (error.value.statusCode === 401) store.login()
})
</script>
