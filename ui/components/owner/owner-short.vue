<template>
  <v-tooltip top>
    <template #activator="{ on }">
      <span class="text-body-2" v-on="on">
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

const env = computed(() => store.env)

const avatarUrl = computed(() => {
  return `${env.value.directoryUrl}/api/avatars/${props.owner.type}/${props.owner.id}/avatar.png`
})

const label = computed(() => {
  let label = props.owner.name
  if (props.owner.role) label += ` (${props.owner.role})`
  return label
})
</script>

<style scoped>
</style>
