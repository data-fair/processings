<template>
  <v-list-item
    :prepend-avatar="avatarUrl"
    :title="ownerName"
  />
  <v-list-item
    v-if="processing.updated"
    :prepend-icon="mdiPencil"
    :title="processing.updated.name"
    :subtitle="dayjs(processing.updated.date).format('D MMM YYYY à HH:mm')"
  />
  <v-list-item
    v-if="processing.created"
    :prepend-icon="mdiPlusCircleOutline"
    :title="processing.created.name"
    :subtitle="dayjs(processing.created.date).format('D MMM YYYY à HH:mm')"
  />
  <v-list-item
    :prepend-icon="mdiPowerPlug"
    :title="pluginTitle"
  />
</template>

<script setup lang="ts">
import type { Processing } from '#api/types'

const { dayjs } = useLocaleDayjs()

const { processing, pluginTitle } = defineProps<{
  processing: Pick<Processing, 'created' | 'updated' | 'owner' | 'plugin'>
  pluginTitle: string | undefined
}>()

const ownerName = computed(() => {
  if (!processing.owner) return ''
  const baseName = processing.owner.name || processing.owner.id
  const departmentInfo = processing.owner.departmentName || processing.owner.department
  return departmentInfo
    ? `${baseName} - ${departmentInfo}`
    : baseName
})
const avatarUrl = computed(() => {
  if (processing.owner.department) return `/simple-directory/api/avatars/${processing.owner.type}/${processing.owner.id}/${processing.owner.department}/avatar.png`
  else return `/simple-directory/api/avatars/${processing.owner.type}/${processing.owner.id}/avatar.png`
})

</script>

<style scoped>
</style>
