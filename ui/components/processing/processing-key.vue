<template>
  <v-menu
    v-if="processing"
    v-model="menu"
    :max-width="1000"
    :close-on-content-click="false"
  >
    <template #activator="{ on: onMenu, attrs }">
      <v-tooltip bottom>
        <template #activator="{ on: onTooltip }">
          <v-btn text v-bind="attrs" v-on="{ ...onTooltip, ...onMenu }">
            <v-icon color="primary" small>mdi-help</v-icon>
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

const props = defineProps({
  processing: { type: Object, required: true }
})

const menu = ref(false)
const store = useStore()

const env = computed(() => store.state.env)

const curl = computed(() => {
  return `curl -X POST ${env.value.publicUrl}/api/v1/processings/${props.processing.id}/_run -H 'x-apikey: ${props.processing.webhookKey}'`
})
</script>
