<template>
  <v-list-item
    :prepend-avatar="avatarUrl"
    :title="ownerName"
    prepend-gap="20"
  />
  <v-list-item
    v-if="processing.updated"
    :prepend-icon="mdiPencil"
    :title="processing.updated.name ?? t('formerUser')"
    :subtitle="dayjs(processing.updated.date).format('D MMM YYYY à HH:mm')"
  />
  <v-list-item
    v-if="processing.created"
    :prepend-icon="mdiPlusCircleOutline"
    :title="processing.created.name ?? t('formerUser')"
    :subtitle="dayjs(processing.created.date).format('D MMM YYYY à HH:mm')"
  />
  <v-list-item
    :prepend-icon="mdiPowerPlug"
    :title="pluginTitle"
  />
</template>

<script setup lang="ts">
import type { Processing } from '#api/types'

const { t } = useI18n()
const { departmentLabel } = useDisplayOwner()
const { dayjs } = useLocaleDayjs()

const { processing, pluginTitle } = defineProps<{
  processing: Pick<Processing, 'created' | 'updated' | 'owner' | 'plugin'>
  pluginTitle: string | undefined
}>()

const ownerName = computed(() => {
  if (!processing.owner) return ''
  const baseName = processing.owner.name || processing.owner.id
  const departmentInfo = departmentLabel(processing.owner.department, processing.owner.departmentName)
  return departmentInfo
    ? `${baseName} - ${departmentInfo}`
    : baseName
})
const avatarUrl = computed(() => {
  if (processing.owner.department) return `/simple-directory/api/avatars/${processing.owner.type}/${processing.owner.id}/${processing.owner.department}/avatar.png`
  else return `/simple-directory/api/avatars/${processing.owner.type}/${processing.owner.id}/avatar.png`
})

</script>

<i18n lang="yaml">
  en:
    formerUser: Former user
  fr:
    formerUser: Ancien utilisateur
</i18n>

<style scoped>
</style>
