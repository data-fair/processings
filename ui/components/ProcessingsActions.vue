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
      @update:model-value="eventBus.emit('search', search)"
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
      @update:model-value="eventBus.emit('plugin', pluginsSelected)"
    />
    <v-switch
      v-if="adminMode"
      v-model="showAll"
      color="admin"
      label="Voir tous les traitements"
      hide-details
      class="mt-4 mx-4 adminSwitch"
      @update:model-value="eventBus.emit('showAll', showAll)"
    />
  </v-list>
</template>

<script setup lang="ts">
import useEventBus from '~/composables/event-bus'
import { type PropType, ref } from 'vue'

const eventBus = useEventBus()

const processingsProps = defineProps({
  adminMode: Boolean,
  facets: { type: Object as PropType<Record<string, any>>, required: true },
  installedPlugins: { type: Object as PropType<Record<string, any>>, required: true },
  isSmall: Boolean,
  processings: { type: Array as PropType<Array<Record<string, any>>>, required: true }
})

const inCreate = ref(false)
const showCreateMenu = ref(false)
const newProcessing: Ref<Record<string, any>> = ref({})
const plugins: Ref<String[]> = ref([])
const pluginsSelected: Ref<String[]> = ref([])
const statusesSelected: Ref<String[]> = ref([])
const search = ref('')
const showAll = ref(false)

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

const statusesItems: Ref<{ display: String, statusKey: String }[]> = computed(() => {
  if (!processingsProps.facets.statuses) return []

  return Object.entries(processingsProps.facets.statuses).map(
    ([statusKey, count]) => ({
      display: `${statusesText[statusKey] || statusKey} (${count})`,
      statusKey
    })
  )
})

async function createProcessing () {
  let processing: Record<string, any> = {}
  inCreate.value = true
  try {
    processing = await $fetch('/api/v1/processings', {
      method: 'POST',
      body: JSON.stringify(newProcessing.value)
    })
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant la création du traitement' })
  } finally {
    showCreateMenu.value = false
    inCreate.value = false
  }
  return navigateTo({ path: `/processings/${processing._id}` })
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
