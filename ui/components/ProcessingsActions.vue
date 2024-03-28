<template>
  <v-list
    density="compact"
    class="list-actions"
    :style="isSmall ? '' : 'background-color: transparent;'"
  >
    <v-menu
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
              name="title"
              label="Titre"
            />
            <v-autocomplete
              v-model="newProcessing.plugin"
              label="Plugin"
              :loading="!installedPlugins.results ? 'primary' : false"
              :items="installedPlugins.results"
              item-title="customName"
              item-value="id"
              clearable
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
            :disabled="!newProcessing.title || !newProcessing.plugin || inCreate"
            color="primary"
            @click="createProcessing()"
          >
            Enregistrer
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
      @update:model-value="eventBus.emit('search', search); getProcessingStatus()"
    />
    <v-select
      v-model="statusesSelected"
      :items="statuses"
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
      @click="getProcessingStatus()"
      @update:model-value="eventBus.emit('status', statusesSelected)"
    />
    <v-select
      v-model="pluginsSelected"
      :items="plugins"
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
      @click="getUsedPlugins()"
      @update:model-value="eventBus.emit('plugin', pluginsSelected)"
    />
  </v-list>
</template>

<script setup lang="ts">
import useEventBus from '~/composables/event-bus'
import { type PropType, ref } from 'vue'

const eventBus = useEventBus()

const processingProps = defineProps({
  installedPlugins: { type: Object as PropType<Record<string, any>>, required: true },
  isSmall: Boolean,
  processings: { type: Array as PropType<Array<Record<string, any>>>, required: true }
})

const inCreate = ref(false)
const showCreateMenu = ref(false)
const newProcessing: Ref<Record<string, any>> = ref({})
const plugins: Ref<Array<string> | Array<never>> = ref([])
const pluginsSelected = ref([])
const search = ref('')
const statuses: Ref<Array<string> | Array<never>> = ref([])
const statusesSelected = ref([])

const statusText: Record<string, string> = {
  error: 'En échec',
  finished: 'Terminé',
  kill: 'Interruption',
  killed: 'Interrompu',
  none: 'Aucune exécution',
  running: 'Démarré',
  scheduled: 'Planifié',
  triggered: 'Déclenché'
}

function getProcessingStatus() {
  if (!processingProps.processings) return statuses
  const array: Array<string> = []
  for (const processing of processingProps.processings) {
    if (processing.lastRun) {
      const status = processing.lastRun.status
      let includes = false
      let index = 0
      for (const element of array) {
        if (element.includes(statusText[status])) {
          includes = true
          index = array.indexOf(element)
          break
        }
      }
      if (includes) {
        array[index] = `${statusText[status]} (${Number(array[index].split('(')[1].replace(')', '')) + 1})`
      } else {
        array.push(`${statusText[status]} (1)`)
      }
    } else {
      let includes = false
      let index = 0
      for (const element of array) {
        if (element.includes(statusText.none)) {
          includes = true
          index = array.indexOf(element)
          break
        }
      }
      if (includes) {
        array[index] = `${statusText.none} (${Number(array[index].split('(')[1].replace(')', '')) + 1})`
      } else {
        array.push(`${statusText.none} (1)`)
      }
    }
    if (processing.nextRun) {
      let includes = false
      let index = 0
      for (const element of array) {
        if (element.includes(statusText.scheduled)) {
          includes = true
          index = array.indexOf(element)
          break
        }
      }
      if (includes) {
        array[index] = `${statusText.scheduled} (${Number(array[index].split('(')[1].replace(')', '')) + 1})`
      } else {
        array.push(`${statusText.scheduled} (1)`)
      }
    }
  }
  statuses.value = array.sort()
  return statuses
}

function getUsedPlugins() {
  if (!processingProps.processings) return plugins
  const array: Array<string> = []
  for (const processing of processingProps.processings) {
    const plugin = processingProps.installedPlugins.results.find((plugin: Record<string, any>) => plugin.id === processing.plugin)
    if (plugin) {
      if (!array.includes(plugin.customName)) {
        array.push(plugin.customName)
      }
    } else {
      if (!array.includes(processing.plugin)) {
        array.push(processing.plugin)
      }
    }
  }
  plugins.value = array.sort()
  return plugins
}

const createProcessing = async () => {
  inCreate.value = true
  const processing: Record<string, any> = await $fetch('/api/v1/processings', {
    method: 'POST',
    body: JSON.stringify(newProcessing.value)
  })
  showCreateMenu.value = false
  inCreate.value = false
  return navigateTo({ path: `/processings/${processing._id}` })
}
</script>

<style>
</style>
