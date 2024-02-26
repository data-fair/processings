<template>
  <v-list dense class="list-actions">
    <v-menu
      v-model="showCreateMenu"
      :close-on-content-click="false"
      min-width="500px"
      max-width="500px"
    >
      <template #activator="{ on, attrs }">
        <v-list-item v-bind="attrs" v-on="on">
          <v-list-item-icon>
            <v-icon color="primary">mdi-plus-circle</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Créer un nouveau traitement</v-list-item-title>
        </v-list-item>
      </template>
      <v-card v-if="newProcessing">
        <v-card-title primary-title>
          <h3 class="text-h5 mb-0">Créer un nouveau traitement</h3>
        </v-card-title>
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
              :loading="!installedPlugins.results"
              :items="installedPlugins.results"
              :item-text="item => `${item.name} - ${item.version}`"
              item-value="id"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showCreateMenu = false">Annuler</v-btn>
          <v-btn
            :disabled="!newProcessing.title || !newProcessing.plugin"
            color="primary"
            @click="createProcessing"
          >
            Enregistrer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </v-list>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'
import { useStore } from '~/store/index'
import { useRouter } from 'vue-router'

const props = defineProps({
  installedPlugins: { type: Object, required: true }
})

const store = useStore()
const router = useRouter()

const showCreateMenu = ref(false)
const newProcessing = ref({})

const user = computed(() => store.user)
const activeAccount = computed(() => store.activeAccount)

const createProcessing = async () => {
  try {
    const response = await axios.post('api/v1/processings', newProcessing.value)
    router.push(`/processings/${response.data._id}`)
  } catch (error) {
    console.error('Failed to create processing:', error)
  }
  showCreateMenu.value = false
}
</script>

<style>

</style>
