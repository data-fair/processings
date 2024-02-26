<template>
  <v-menu
    v-model="menu"
    width="500"
    :close-on-click="false"
    :close-on-content-click="false"
  >
    <template #activator="{ on }">
      <v-btn icon color="warning" text v-on="on" @click="open">
        <v-icon>mdi-delete</v-icon>
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="text-h6">
        Suppression d'un élément
      </v-card-title>
      <v-card-text>
        <p>
          Voulez vous vraiment supprimer le traitement
          <span v-if="processing.title" class="accent--text">{{ processing.title }}</span> ?
        </p>
        <p>La suppression est définitive.</p>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="menu = false">Annuler</v-btn>
        <v-btn color="warning" @click="confirm">Oui</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'
import { useEventBus } from '~/composables/useEventBus' // Assuming a composable for EventBus
import { useRouter } from 'vue-router'

const props = defineProps({
  processing: { type: Object, default: () => ({}) }
})

const menu = ref(false)
const router = useRouter()
const { emitNotification } = useEventBus()

const open = (e) => {
  menu.value = true
  e.stopPropagation()
}

const confirm = async () => {
  try {
    await axios.delete(`api/v1/processings/${props.processing.id}`)
    emit('removed', { id: props.processing.id })
    emitNotification({ msg: 'Traitement supprimé avec succès', type: 'success' })
  } catch (error) {
    emitNotification({ error, msg: 'Erreur pendant la suppression du traitement', type: 'error' })
  } finally {
    menu.value = false
  }
}
</script>
