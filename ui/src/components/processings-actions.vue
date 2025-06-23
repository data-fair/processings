<template>
  <v-list
    density="compact"
    class="list-actions"
    style="background-color: transparent;"
    data-iframe-height
  >
    <v-list-item
      :to="{ path: '/processings/new', query: { owner: ownersSelected.length ? ownersSelected[0] as string : undefined } }"
      rounded
    >
      <template #prepend>
        <v-icon
          color="primary"
          :icon="mdiPlusCircle"
        />
      </template>
      Créer un nouveau traitement
    </v-list-item>
    <v-text-field
      v-model="search"
      :append-inner-icon="mdiMagnify"
      class="mt-4 mx-4"
      clearable
      color="primary"
      density="compact"
      hide-details
      hide-selected
      placeholder="rechercher"
      style="max-width:400px;"
      variant="outlined"
    />
    <v-select
      v-model="statusesSelected"
      :items="statusesItems"
      item-title="display"
      item-value="statusKey"
      label="Statut"
      chips
      class="mt-4 mx-4"
      clearable
      closable-chips
      density="compact"
      hide-details
      multiple
      rounded="xl"
      variant="outlined"
      style="max-width:400px;"
    />
    <v-autocomplete
      v-model="pluginsSelected"
      :items="pluginsItems"
      item-title="display"
      item-value="pluginKey"
      label="Plugin"
      chips
      class="mt-4 mx-4"
      clearable
      closable-chips
      density="compact"
      hide-details
      multiple
      rounded="xl"
      variant="outlined"
      style="max-width:400px;"
    />
    <v-switch
      v-if="adminMode"
      v-model="showAll"
      color="admin"
      label="Voir tous les traitements"
      hide-details
      class="mt-2 mx-4 text-admin"
    />
    <v-autocomplete
      v-if="showAll"
      v-model="ownersSelected"
      :items="ownersItems"
      item-title="display"
      item-value="ownerKey"
      label="Propriétaire"
      chips
      class="mt-2 mx-4 text-admin"
      clearable
      closable-chips
      density="compact"
      hide-details
      multiple
      rounded="xl"
      variant="outlined"
      style="max-width:400px;"
    />
  </v-list>
</template>

<script setup lang="ts">

const processingsProps = defineProps<{
  adminMode: boolean,
  ownerFilter: string,
  facets: { statuses: Record<string, number>, plugins: Record<string, number>, owners: { id: string, name: string, totalCount: number, type: string, departments: { department: string, departmentName: string, count: number }[] }[] },
  processings: any[]
}>()

const search = defineModel('search', { type: String, default: '' })
const showAll = defineModel('showAll', { type: Boolean, default: false })
const pluginsSelected = defineModel('pluginsSelected', { type: Array, required: true })
const statusesSelected = defineModel('statusesSelected', { type: Array, required: true })
const ownersSelected = defineModel('ownersSelected', { type: Array, required: true })

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
