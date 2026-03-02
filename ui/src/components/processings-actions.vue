<template>
  <!-- Create new processing -->
  <v-list-item
    v-if="canAdmin"
    rounded
    @click="router.push({ path: '/processings/new', query: { owner: ownersSelected.length ? String(ownersSelected[0]) : undefined } })"
  >
    <template #prepend>
      <v-icon
        color="primary"
        :icon="mdiPlusCircle"
      />
    </template>
    Créer un nouveau traitement
  </v-list-item>

  <!-- Notifications menu -->
  <v-menu
    v-if="eventsSubscribeUrl"
    v-model="showNotifMenu"
    :close-on-content-click="false"
    max-width="500"
  >
    <template #activator="{ props }">
      <v-list-item
        v-bind="props"
        rounded
      >
        <template #prepend>
          <v-icon
            color="primary"
            :icon="mdiBell"
          />
        </template>
        Notifications
      </v-list-item>
    </template>
    <v-card
      title="Notifications"
      rounded="lg"
    >
      <v-card-text class="pa-0">
        <d-frame :src="eventsSubscribeUrl" />
      </v-card-text>
    </v-card>
  </v-menu>

  <!-- Search field -->
  <v-text-field
    v-model="search"
    :append-inner-icon="mdiMagnify"
    label="Rechercher"
    class="mt-4 mx-4"
    color="primary"
    density="compact"
    variant="outlined"
    autofocus
    hide-details
    clearable
  />

  <!-- Status filters -->
  <v-select
    v-model="statusesSelected"
    :items="statusesItems"
    item-title="display"
    item-value="statusKey"
    class="mt-4 mx-4"
    density="compact"
    label="Status"
    rounded="xl"
    variant="outlined"
    hide-details
    chips
    clearable
    closable-chips
    multiple
  />

  <!-- Plugin filters -->
  <v-autocomplete
    v-model="pluginsSelected"
    :items="pluginsItems"
    item-title="display"
    item-value="pluginKey"
    class="mt-4 mx-4"
    density="compact"
    label="Plugin"
    rounded="xl"
    variant="outlined"
    hide-details
    chips
    clearable
    closable-chips
    multiple
  />

  <!-- Show all switch (admin only) -->
  <v-switch
    v-if="adminMode"
    v-model="showAll"
    color="admin"
    label="Voir tous les traitements"
    hide-details
    class="mt-2 mx-4 text-admin"
  />

  <!-- Owner filters (only if showAll and admin) -->
  <v-autocomplete
    v-if="showAll"
    v-model="ownersSelected"
    :items="ownersItems"
    item-title="display"
    item-value="ownerKey"
    class="mt-2 mx-4 text-admin"
    density="compact"
    label="Propriétaire"
    rounded="xl"
    variant="outlined"
    chips
    clearable
    closable-chips
    hide-details
    multiple
  />
</template>

<script setup lang="ts">
import '@data-fair/frame/lib/d-frame.js'

const router = useRouter()
const processingsProps = defineProps<{
  adminMode: boolean,
  canAdmin: boolean,
  facets: { statuses: Record<string, number>, plugins: Record<string, number>, owners: { id: string, name: string, totalCount: number, type: string, departments: { department: string, departmentName: string, count: number }[] }[] },
  ownerFilter: string,
  processings: any[]
}>()

const search = defineModel('search', { type: String, default: '' })
const showAll = defineModel('showAll', { type: Boolean, default: false })
const pluginsSelected = defineModel('pluginsSelected', { type: Array, required: true })
const statusesSelected = defineModel('statusesSelected', { type: Array, required: true })
const ownersSelected = defineModel('ownersSelected', { type: Array, required: true })
const showNotifMenu = ref(false)

const statusesText: Record<string, string> = {
  error: 'En échec',
  finished: 'Terminé',
  kill: 'Interruption',
  killed: 'Interrompu',
  none: 'Aucune exécution',
  running: 'Démarré',
  scheduled: 'Planifié',
  triggered: 'Déclenché'
}

type InstalledPlugin = {
  name: string
  description: string
  version: string
  distTag: string
  id: string
  pluginConfigSchema: any
  processingConfigSchema: any
  metadata: {
    name: string
    description: string
    category: string
    icon: Record<string, string>
  }
}

const installedPluginsFetch = useFetch<{ results: InstalledPlugin[], count: number }>(`${$apiPath}/plugins?privateAccess=${processingsProps.ownerFilter}`)
const installedPlugins = computed(() => installedPluginsFetch.data.value?.results)

const eventsSubscribeUrl = computed(() => {
  const topics = [
    { key: 'processings:processing-finish-ok', title: 'Un traitement s\'est terminé sans erreurs' },
    { key: 'processings:processing-finish-error', title: 'Un traitement a échoué' },
    { key: 'processings:processing-log-error', title: 'Un traitement s\'est terminé correctement mais son journal contient des erreurs' },
    { key: 'processings:processing-disabled', title: 'Un traitement a été désactivé car il a échoué trop de fois à la suite' }
  ]
  const urlTemplate = window.parent.location.origin + '/data-fair/processings/{processingId}'
  return `/events/embed/subscribe?key=${encodeURIComponent(topics.map(t => t.key).join(','))}&title=${encodeURIComponent(topics.map(t => t.title).join(','))}&url-template=${encodeURIComponent(urlTemplate)}&register=false`
})

const statusesItems = computed(() => {
  if (!processingsProps.facets.statuses) return []

  return Object.entries(processingsProps.facets.statuses)
    .map(([statusKey, count]) => ({
      display: `${statusesText[statusKey] || statusKey} (${count})`,
      statusKey
    }))
    .sort((a, b) => a.display.localeCompare(b.display))
})

const pluginsItems = computed(() => {
  if (!installedPlugins.value) return []
  if (!processingsProps.facets.plugins) return []

  return Object.entries(processingsProps.facets.plugins)
    .map(
      ([pluginKey, count]) => {
        const customName = installedPlugins.value?.find((plugin) => plugin.id === pluginKey)?.metadata.name
        return {
          display: `${customName || 'Supprimé - ' + pluginKey} (${count})`,
          pluginKey
        }
      }
    )
    .sort((a, b) => a.display.localeCompare(b.display))
})

const ownersItems = computed(() => {
  if (!processingsProps.facets.owners) return []

  return Object.entries(processingsProps.facets.owners)
    .flatMap(([, owner]) => {
      const items = []

      // Si l'organisation a des départements
      if (owner.departments.length > 0) {
        owner.departments.forEach(department => {
          // Ajout d'un élément pour chaque département
          items.push({
            display: `${owner.name} - ${department.departmentName || department.department} (${department.count})`,
            ownerKey: `organization:${owner.id}:${department.department}`
          })
        })
      }

      items.push({
        display: `${owner.name} (${owner.totalCount})`,
        ownerKey: `${owner.type}:${owner.id}`
      })
      return items
    })
    .sort((a, b) => a.display.localeCompare(b.display))
})

</script>

<style scoped>
</style>
