<template>
  <v-list
    density="compact"
    class="list-actions"
    style="background-color: transparent;"
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
            <v-icon color="primary">
              mdi-plus-circle
            </v-icon>
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
            <v-select
              v-model="newProcessing.plugin"
              label="Plugin"
              :loading="!installedPlugins.results ? 'primary' : false"
              :items="installedPlugins.results"
              :item-title="item => `${item.name} - ${item.version}`"
              item-value="id"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
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
  </v-list>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  installedPlugins: { type: Object, required: true }
})

const inCreate = ref(false)
const showCreateMenu = ref(false)
const newProcessing = ref({})

const createProcessing = async () => {
  inCreate.value = true
  const response = await $fetch('/api/v1/processings', {
    method: 'POST',
    body: { ...newProcessing.value }
  })
  showCreateMenu.value = false
  inCreate.value = false
  return navigateTo({ path: `/processings/${response._id}` })
}
</script>

<style>
</style>
