<template>
  <v-list
    density="compact"
    class="list-actions"
    :style="isSmall ? '' : 'background-color: transparent;'"
    data-iframe-height
  >
    <v-list-item v-if="installedPluginsFetch.loading.value">
      <v-progress-circular
        indeterminate
        color="primary"
        size="x-small"
        width="3"
      />
    </v-list-item>
    <v-menu
      v-else
      v-model="showCreateMenu"
      :close-on-content-click="false"
      min-width="500px"
      max-width="500px"
    >
      <template #activator="{ props }">
        <v-list-item v-bind="props">
          <template #prepend>
            <v-icon
              color="primary"
              :icon="mdiPlusCircle"
            />
          </template>
          Créer un nouveau traitement
        </v-list-item>
      </template>
      <v-card
        v-if="newProcessing"
        rounded="lg"
        data-iframe-height
      >
        <v-card-title primary-title>
          <h3 class="text-h5 mb-0">
            Créer un nouveau traitement
          </h3>
        </v-card-title>
        <v-progress-linear
          v-if="inCreate"
          indeterminate
          color="primary"
        />
        <v-card-text>
          <v-form>
            <v-text-field
              v-model="newProcessing.title"
              label="Titre"
            />
            <v-autocomplete
              v-model="newProcessing.plugin"
              label="Plugin"
              :loading="!installedPlugins ? 'primary' : false"
              :items="installedPlugins"
              item-title="customName"
              item-value="id"
              clearable
            />
            <owner-pick
              v-model="newProcessing.owner"
              v-model:ready="ownersReady"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="inCreate"
            variant="text"
            @click="showCreateMenu = false"
          >
            Annuler
          </v-btn>
          <v-btn
            :disabled="!ownersReady || !newProcessing.title || !newProcessing.plugin || inCreate"
            color="primary"
            @click="createProcessing()"
          >
            Créer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
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
import OwnerPick from '@data-fair/lib-vuetify/owner-pick.vue'

const processingsProps = defineProps<{
  adminMode: boolean,
  ownerFilter: string,
  facets: { statuses: Record<string, number>, plugins: Record<string, number>, owners: { id: string, name: string, totalCount: number, type: string, departments: { department: string, departmentName: string, count: number }[] }[] },
  isSmall: boolean,
  processings: any[]
}>()

const search = defineModel('search', { type: String, default: '' })
const showAll = defineModel('showAll', { type: Boolean, default: false })
const pluginsSelected = defineModel('pluginsSelected', { type: Array, required: true })
const statusesSelected = defineModel('statusesSelected', { type: Array, required: true })
const ownersSelected = defineModel('ownersSelected', { type: Array, required: true })

const router = useRouter()

const inCreate = ref(false)
const showCreateMenu = ref(false)
const newProcessing: Ref<Record<string, string>> = ref({})
const ownersReady = ref(false)

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
  customName: string
  description: string
  version: string
  distTag: string
  id: string
  pluginConfigSchema: any
  processingConfigSchema: any
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
        const customName = installedPlugins.value?.find((plugin) => plugin.id === pluginKey)?.customName
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

const createProcessing = withUiNotif(
  async () => {
    inCreate.value = true

    const processing = await $fetch('/processings', {
      method: 'POST',
      body: JSON.stringify(newProcessing.value)
    })

    await router.push({ path: `/processings/${processing._id}` })
    showCreateMenu.value = false
    inCreate.value = false
  },
  'Erreur pendant la création du traitement',
  { msg: 'Traitement créé avec succès !' }
)

</script>

<style scoped>
</style>
