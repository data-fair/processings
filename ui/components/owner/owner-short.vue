<template>
  <v-tooltip location="top">
    <template #activator>
      <span class="text-body-2">
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
import { useStore } from '~/store/index'

const props = defineProps({
  owner: Object
})

const store = useStore()

const avatarUrl = computed(() => {
  return `${env.value.directoryUrl}/api/avatars/${props.owner.type}/${props.owner.id}/avatar.png`
})

const env = computed(() => store.env)

const label = computed(() => {
  let label = props.owner.name
  if (props.owner.role) label += ` (${props.owner.role})`
  return label
})
</script>

<style>
</style>
