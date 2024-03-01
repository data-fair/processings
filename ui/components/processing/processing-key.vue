<template>
  <v-menu
    v-if="processing"
    v-model="menu"
    :max-width="1000"
    :close-on-content-click="false"
  >
    <template #activator="{ props }">
      <v-tooltip location="bottom">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            variant="text"
            v-bind="props"
            v-on="tooltipProps.on"
          >
            <v-icon
              color="primary"
              size="small"
            >
              mdi-help
            </v-icon>
          </v-btn>
        </template>
        <span>Déclenchement par webhook</span>
      </v-tooltip>
    </template>
    <v-card>
      <v-card-title>
        Vous pouvez déclencher une exécution du traitement avec l'appel suivant :
      </v-card-title>
      <v-card-text>
        <code style="width: 100%;">
          {{ curl }}
        </code>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from '~/store/index'

const properties = defineProps({
  processing: { type: Object, required: true }
})

const store = useStore()

const menu = ref(null)

const env = computed(() => store.env)
const curl = computed(() => {
  return `curl -X POST ${env.value.publicUrl}/api/v1/processings/${properties.processing.id}/_run -H 'x-apikey: ${properties.processing.webhookKey}'`
})
</script>

<style>
</style>
