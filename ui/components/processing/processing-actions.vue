<template>
  <v-list
    density="compact"
    class="list-actions"
  >
    <v-menu
      v-if="canAdmin || canExec"
      v-model="showTriggerMenu"
      :close-on-content-click="false"
      max-width="800"
    >
      <template #activator="{ props }">
        <v-list-item
          v-bind="props"
          :disabled="!processing?.active"
        >
          <template #prepend>
            <v-icon color="primary">
              mdi-play
            </v-icon>
          </template>
          <span>Exécuter</span>
        </v-list-item>
      </template>
      <v-card
        rounded="lg"
        variant="elevated"
      >
        <v-card-title primary-title>
          Exécution du traitement
        </v-card-title>
        <v-card-text>
          <p v-if="canAdmin">
            Vous pouvez déclencher une exécution sans être connecté à la plateforme en envoyant une requête HTTP POST à cette URL sécurisée :
            <br>{{ webhookLink }}
          </p>
          <v-text-field
            v-model="triggerDelay"
            type="number"
            label="Appliquer un délai en secondes"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showTriggerMenu = false"
          >
            Annuler
          </v-btn>
          <v-btn
            color="primary"
            @click="triggerExecution, $emit('triggered')"
          >
            Déclencher manuellement
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-menu
      v-if="canAdmin"
      v-model="showDeleteMenu"
      :close-on-content-click="false"
      max-width="500"
    >
      <template #activator="{ props }">
        <v-list-item v-bind="props">
          <template #prepend>
            <v-icon color="warning">
              mdi-delete
            </v-icon>
          </template>
          Supprimer
        </v-list-item>
      </template>
      <v-card
        rounded="lg"
        variant="elevated"
      >
        <v-card-title primary-title>
          Suppression du traitement
        </v-card-title>
        <v-card-text>
          Voulez-vous vraiment supprimer le traitement "{{ processing?.title }}" et tout son historique ? La suppression est définitive et les données ne pourront pas être récupérées.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeleteMenu = false"
          >
            Non
          </v-btn>
          <v-btn
            color="warning"
            @click="confirmRemove"
          >
            Oui
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-list-item
      v-if="processing?.config && processing.config.dataset && processing.config.dataset.id"
      :href="`${env.dataFairUrl}/dataset/${processing.config.dataset.id}`"
      target="_blank"
    >
      <template #prepend>
        <v-icon color="primary">
          mdi-open-in-new
        </v-icon>
      </template>
      Voir le jeu de données
    </v-list-item>

    <v-menu
      v-if="notifUrl && processing?.owner.type === activeAccount.type && processing?.owner.id === activeAccount.id && !activeAccount.department"
      v-model="showNotifMenu"
      max-width="500"
      min-width="500"
      :close-on-content-click="false"
    >
      <template #activator="{ props }">
        <v-list-item v-bind="props">
          <template #prepend>
            <v-icon color="primary">
              mdi-bell
            </v-icon>
          </template>
          Notifications
        </v-list-item>
      </template>
      <v-card
        rounded="lg"
        variant="elevated"
      >
        <v-card-title primary-title>
          Notifications
        </v-card-title>
        <v-card-text class="py-0 px-3">
          <v-iframe :src="notifUrl" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            @click="showNotifMenu = false"
          >
            ok
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </v-list>
</template>

<script setup>
import 'iframe-resizer/js/iframeResizer'
import useEventBus from '~/composables/event-bus'
import VIframe from '@koumoul/v-iframe'
import { computed, ref, watch } from 'vue'
import { useStore } from '~/store'

defineEmits(['triggered'])

const properties = defineProps({
  canAdmin: Boolean,
  canExec: Boolean,
  processing: Object
})

const eventBus = useEventBus()
const store = useStore()

const showDeleteMenu = ref(false)
const showNotifMenu = ref(false)
const showTriggerMenu = ref(false)
const triggerDelay = ref(0)
const webhookKey = ref(null)

const activeAccount = computed(() => store.activeAccount)
const env = computed(() => store.env)

const notifUrl = computed(() => {
  if (!env.value.notifyUrl) return null
  const topics = [
    { key: `processings:processing-finish-ok:${properties.processing?._id ?? ''}`, title: `Le traitement ${properties.processing?.title ?? ''} a terminé avec succès` },
    { key: `processings:processing-finish-error:${properties.processing?._id}`, title: `Le traitement ${properties.processing?.title} a terminé en échec` },
    { key: `processings:processing-log-error:${properties.processing?._id}`, title: `Le traitement ${properties.processing?.title} a terminé correctement mais son journal contient des erreurs` }
  ]
  const urlTemplate = window.parent.location.href
  return `${env.value.notifyUrl}/embed/subscribe?key=${encodeURIComponent(topics.map(t => t.key).join(','))}&title=${encodeURIComponent(topics.map(t => t.title).join(','))}&url-template=${encodeURIComponent(urlTemplate)}&register=false`
})

const webhookLink = computed(() => {
  let link = `${env.value.publicUrl}/api/v1/processings/${properties.processing?._id}/_trigger?key=${webhookKey.value}`
  if (triggerDelay.value > 0) link += `&delay=${triggerDelay.value}`
  return link
})

const confirmRemove = async () => {
  showDeleteMenu.value = false
  try {
    await $fetch(`${env.value.publicUrl}/api/v1/processings/${properties.processing?._id}`, {
      method: 'DELETE'
    })
    return navigateTo({ path: '/processings' })
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant la suppression du traitement' })
  }
}

const getWebhookKey = async () => {
  webhookKey.value = await $fetch(`${env.value.publicUrl}/api/v1/processings/${properties.processing?._id}/webhook-key`)
}

const triggerExecution = async () => {
  try {
    await $fetch(`${env.value.publicUrl}/api/v1/processings/${properties.processing?._id}/_trigger`, {
      method: 'POST',
      body: { delay: triggerDelay.value }
    })
    showTriggerMenu.value = false
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant le déclenchement du traitement' })
  }
}

watch(showTriggerMenu, async (newValue) => {
  if (newValue && properties.canAdmin) {
    await getWebhookKey()
  }
})
</script>

<style>
</style>
