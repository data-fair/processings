<template>
  <v-menu
    v-model="menu"
    width="500"
    persistent
    :close-on-content-click="false"
  >
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        icon="mdi-delete"
        color="warning"
        variant="text"
        @click="open()"
      />
    </template>

    <v-card>
      <v-card-title class="text-h6">
        Suppression d'un élément
      </v-card-title>
      <v-card-text>
        <p>
          Voulez vous vraiment supprimer le traitement
          <span
            v-if="processing.title"
            class="text-accent"
          >{{ processing.title }}</span> ?
        </p>
        <p>La suppression est définitive.</p>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="menu = false"
        >
          Annuler
        </v-btn>
        <v-btn
          color="warning"
          @click="confirm()"
        >
          Oui
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup>
import useEventBus from '~/composables/event-bus'
import { ref } from 'vue'

const emit = defineEmits(['removed'])
const processingProps = defineProps({
  processing: { type: Object, default: () => ({}) }
})

const menu = ref(false)
const eventBus = useEventBus()

const open = (e) => {
  menu.value = true
  e.stopPropagation()
}

const confirm = async () => {
  try {
    await $fetch(`/api/v1/processings/${processingProps.processing.id}`, {
      method: 'DELETE'
    })
    emit('removed', { id: processingProps.processing.id })
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant la suppression du traitement' })
  } finally {
    menu.value = false
  }
}
</script>

<style>
</style>
