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
              item-title="fullName"
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
    <v-autocomplete
      v-model="search"
      :items="processings"
      :loading="processings == [] ? 'primary' : false"
      placeholder="rechercher"
      variant="outlined"
      hide-details
      hide-selected
      hide-no-data
      multiple
      menu-icon=""
      clearable
      :return-object="true"
      chips
      rounded="xl"
      closable-chips
      style="max-width:400px;"
      class="mt-4 mr-4"
      color="primary"
      append-inner-icon="mdi-magnify"
      @update:model-value="eventBus.emit('search', search)"
    />
  </v-list>
</template>

<script setup>
import useEventBus from '~/composables/event-bus'
import { ref } from 'vue'

const eventBus = useEventBus()

defineProps({
  installedPlugins: { type: Object, required: true },
  isSmall: Boolean,
  processings: { type: Array, required: true }
})

const inCreate = ref(false)
const showCreateMenu = ref(false)
const newProcessing = ref({})
const search = ref([])

const createProcessing = async () => {
  inCreate.value = true
  /** @type import('../../shared/types/index.js').processingType */
  const processing = await $fetch('/api/v1/processings', {
    method: 'POST',
    body: JSON.stringify({ ...newProcessing.value })
  })
  showCreateMenu.value = false
  inCreate.value = false
  return navigateTo({ path: `/processings/${processing._id}` })
}
</script>

<style>
</style>
