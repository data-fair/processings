<template>
  <span>
    <span>{{ sourceTypeTitle }}</span>
    <v-menu
      v-if="processing"
      v-model="menu"
      :max-width="1200"
      :close-on-content-click="false"
    >
      <template #activator="{ on, attrs }">
        <v-tooltip bottom>
          <template #activator="{ on: onTooltip }">
            <v-btn
              text
              style="height: 20px;"
              v-bind="attrs"
              v-on="{ ...onTooltip, ...on }"
            >
              <v-icon
                color="primary"
                size="20"
              >
                mdi-information
              </v-icon>
            </v-btn>
          </template>
          <span>Description du traitement</span>
        </v-tooltip>
      </template>
      <v-card class="py-3">
        <v-simple-table>
          <thead>
            <tr>
              <th class="text-center" style="width:45%;">Entrée</th>
              <th style="width:10%;" />
              <th class="text-center" style="width:45%;">Données interopérables</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center">{{ sourceTypeDescription }}</td>
              <td class="text-center">
                <v-icon x-large color="primary">mdi-arrow-right</v-icon>
              </td>
              <td class="text-center">
                <v-simple-table>
                  <tbody>
                    <tr>
                      <td class="text-left">Description</td>
                      <td>{{ sourceTypeXOutput }}</td>
                    </tr>
                    <tr v-if="datasetSchema">
                      <td class="text-left">Champs</td>
                      <td>{{ datasetSchemaFields }}</td>
                    </tr>
                    <tr v-if="datasetSchemaConcepts.length">
                      <td class="text-left">Concepts</td>
                      <td>
                        <v-chip
                          v-for="concept in datasetSchemaConcepts"
                          :key="concept"
                          color="primary"
                          class="ma-1"
                        >
                          {{ concept }}
                        </v-chip>
                      </td>
                    </tr>
                  </tbody>
                </v-simple-table>
              </td>
            </tr>
          </tbody>
        </v-simple-table>
      </v-card>
    </v-menu>
  </span>
</template>

<script setup>
import axios from 'axios'
import { ref, computed, onMounted } from 'vue'
import { useStore } from '~/store/index'

const props = defineProps({
  processing: { type: Object, required: true }
})

const store = useStore()
const menu = ref(false)
const vocabulary = ref([])
const processingSchema = ref(null)

const sourceType = computed(() => {
  return processingSchema.value?.properties?.source?.oneOf.find(s => s.properties.type.const === props.processing.source.type)
})

const sourceTypeTitle = computed(() => {
  return sourceType.value?.title || 'Non défini'
})

const sourceTypeDescription = computed(() => {
  return sourceType.value?.description || 'Non défini'
})

const sourceTypeXOutput = computed(() => {
  return sourceType.value?.['x-output'] || 'Non défini'
})

const datasetSchema = computed(() => {
  try {
    return require('../../sources/' + props.processing.source.type + '/schema.json')
  } catch (err) {
    console.error('No schema for processing type')
    return null
  }
})

const datasetSchemaFields = computed(() => {
  return datasetSchema.value?.map(f => f.key).join(', ') || 'Non défini'
})

const datasetSchemaConcepts = computed(() => {
  return datasetSchema.value
    ?.filter(f => f['x-refersTo'])
    .map(f => conceptLabel(f['x-refersTo'])) || []
})

onMounted(async () => {
  vocabulary.value = await axios.get(store.env.dataFairUrl + '/api/v1/vocabulary').then(res => res.data)
  processingSchema.value = await axios.get('api/v1/processings/_schema').then(res => res.data)
})

function conceptLabel(uri) {
  const concept = vocabulary.value.find(t => t.identifiers?.includes(uri))
  return concept?.title || 'Concept inconnu'
}
</script>
