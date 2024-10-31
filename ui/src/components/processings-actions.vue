<template>
  <v-list
    density="compact"
    class="list-actions"
    :style="isSmall ? '' : 'background-color: transparent;'"
    data-iframe-height
  >
    <v-list-item v-if="installedPluginsFetch.error.value">
      <fetch-error
        :error="installedPluginsFetch.error.value"
      />
    </v-list-item>
    <v-list-item v-else-if="installedPluginsFetch.pending.value">
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
              icon="mdi-plus-circle"
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
      append-inner-icon="mdi-magnify"
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
    <v-select
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
      class="mt-4 mx-4 adminSwitch"
    />
  </v-list>
</template>

<script setup>
import useEventBus from '~/composables/event-bus'
import { ref } from 'vue'
import OwnerPick from '@data-fair/lib-vuetify/owner-pick.vue'

const eventBus = useEventBus()

const processingsProps = defineProps({
  adminMode: Boolean,
  ownerFilter: { type: String, required: true },
  facets: { type: Object, required: true },
  isSmall: Boolean,
  processings: { type: Array, required: true }
})

const search = defineModel('search', { type: String, default: '' })
const showAll = defineModel('showAll', { type: Boolean, default: false })
const pluginsSelected = defineModel('pluginsSelected', { type: Array, required: true })
const statusesSelected = defineModel('statusesSelected', { type: Array, required: true })

const inCreate = ref(false)
const showCreateMenu = ref(false)
const newProcessing = ref({})
const ownersReady = ref(false)

const statusesText = {
  error: 'En échec',
  finished: 'Terminé',
  kill: 'Interruption',
  killed: 'Interrompu',
  none: 'Aucune exécution',
  running: 'Démarré',
  scheduled: 'Planifié',
  triggered: 'Déclenché'
}

/**
 * @typedef InstalledPlugin
 * @property {string} name
 * @property {string} customName
 * @property {string} description
 * @property {string} version
 * @property {string} distTag
 * @property {string} id
 * @property {any} pluginConfigSchema
 * @property {any} processingConfigSchema
 */

/** @type {Awaited<ReturnType<typeof useFetch<{count: number, results: InstalledPlugin[]}>>>}  */
const installedPluginsFetch = await useFetch(`/api/v1/plugins?privateAccess=${processingsProps.ownerFilter}`, { lazy: true })
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
        const customName = installedPlugins.value.find((plugin) => plugin.id === pluginKey)?.customName
        return {
          display: `${customName || 'Supprimé - ' + pluginKey} (${count})`,
          pluginKey
        }
      }
    )
    .sort((a, b) => a.display.localeCompare(b.display))
})

async function createProcessing () {
  inCreate.value = true
  try {
    const processing = await $fetch('/api/v1/processings', {
      method: 'POST',
      body: JSON.stringify(newProcessing.value)
    })
    return navigateTo({ path: `/processings/${processing._id}` })
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant la création du traitement' })
  } finally {
    showCreateMenu.value = false
    inCreate.value = false
  }
}

</script>

<style scoped>
/*
 * This aims at making the button looking better.
 * Instead of having a white string on a red background, we have a red string on the actual page's background
 * Plus the button is also red, and the text is bold so it's easier to read
 */
:deep(.adminSwitch) {
  background-color: transparent !important;
  color: rgb(var(--v-theme-admin)) !important;
}

:deep(.adminSwitch .v-switch__thumb) {
  background-color: rgb(var(--v-theme-admin)) !important;
}

:deep(.adminSwitch .v-switch__track) {
  background-color: rgb(var(--v-theme-admin)) !important;
  filter: saturate(100%);
}

:deep(.adminSwitch .v-switch__track:not(.bg-admin)) {
  filter: saturate(50%);
}

:deep(.adminSwitch label) {
  color: rgb(var(--v-theme-admin)) !important;
  font-weight: bold !important;
  padding-inline-start: 30px !important;
}
</style>
