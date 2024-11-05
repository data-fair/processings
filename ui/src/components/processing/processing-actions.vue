<template>
  <v-list
    density="compact"
    class="list-actions"
    :style="isSmall ? '' : 'background-color: transparent;'"
    data-iframe-height
  >
    <v-menu
      v-if="canAdmin || canExec"
      v-model="showTriggerMenu"
      :close-on-content-click="false"
      max-width="800"
    >
      <template #activator="{ props }">
        <v-list-item
          v-if="processingSchema !== null"
          v-bind="props"
          :disabled="!processing?.active || edited"
        >
          <template #prepend>
            <v-icon
              color="primary"
              :icon="mdiPlay"
            />
          </template>
          <span>Exécuter</span>
        </v-list-item>
        <v-progress-linear
          v-if="edited"
          indeterminate
          color="primary"
        />
      </template>
      <v-card
        rounded="lg"
        variant="elevated"
      >
        <v-card-title primary-title>
          Exécution du traitement
        </v-card-title>
        <v-progress-linear
          v-if="hasTriggered"
          indeterminate
          color="primary"
          class="mb-4"
        />
        <v-card-text class="py-0">
          <p v-if="canAdmin">
            Vous pouvez déclencher une exécution sans être connecté à la plateforme en envoyant une requête HTTP POST à cette URL sécurisée :
            <br><code>{{ webhookLink }}</code>
          </p>
          <v-text-field
            v-model="triggerDelay"
            class="py-4"
            type="number"
            label="Appliquer un délai en secondes"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="hasTriggered"
            @click="showTriggerMenu = false"
          >
            Annuler
          </v-btn>
          <v-btn
            color="primary"
            :disabled="hasTriggered"
            @click="triggerExecution()"
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
            <v-icon
              color="warning"
              :icon="mdiDelete"
            />
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
        <v-progress-linear
          v-if="inDelete"
          indeterminate
          color="warning"
        />
        <v-card-text>
          Voulez-vous vraiment supprimer le traitement "{{ processing?.title }}" et tout son historique ? La suppression est définitive et les données ne pourront pas être récupérées.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="inDelete"
            @click="showDeleteMenu = false"
          >
            Non
          </v-btn>
          <v-btn
            color="warning"
            :disabled="inDelete"
            @click="confirmRemove()"
          >
            Oui
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
    <v-list-item
      v-if="processing && processing.config && processing.config.dataset && processing.config.dataset.id"
      :href="`/data-fair/dataset/${processing.config.dataset.id}`"
      target="_blank"
    >
      <template #prepend>
        <v-icon
          color="primary"
          :icon="mdiOpenInNew"
        />
      </template>
      Voir le jeu de données
    </v-list-item>

    <v-menu
      v-if="notifUrl && processing?.owner.type === activeAccount?.type && processing?.owner.id === activeAccount?.id && !activeAccount?.department"
      v-model="showNotifMenu"
      :close-on-content-click="false"
      max-width="500"
    >
      <template #activator="{ props }">
        <v-list-item
          v-if="processingSchema !== null"
          v-bind="props"
        >
          <template #prepend>
            <v-icon
              color="primary"
              :icon="mdiBell"
            />
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
          <v-iframe
            :src="notifUrl"
            style="color-scheme: normal;"
          />
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

<script setup lang="ts">
import 'iframe-resizer/js/iframeResizer'
// @ts-ignore
import VIframe from '@koumoul/v-iframe'
const emit = defineEmits(['triggered'])

const properties = defineProps({
  canAdmin: Boolean,
  canExec: Boolean,
  edited: Boolean,
  isSmall: Boolean,
  processing: {
    type: Object,
    default: null
  },
  processingSchema: {
    type: Object,
    default: null
  }
})

const inDelete = ref(false)
const hasTriggered = ref(false)
const showDeleteMenu = ref(false)
const showNotifMenu = ref(false)
const showTriggerMenu = ref(false)
const triggerDelay = ref(0)
const webhookKey = ref('')

const router = useRouter()
const session = useSession()
const activeAccount = computed(() => session.state.account)

const notifUrl = computed(() => {
  const topics = [
    { key: `processings:processing-finish-ok:${properties.processing?._id ?? ''}`, title: `Le traitement ${properties.processing?.title ?? ''} a terminé avec succès` },
    { key: `processings:processing-finish-error:${properties.processing?._id}`, title: `Le traitement ${properties.processing?.title} a terminé en échec` },
    { key: `processings:processing-log-error:${properties.processing?._id}`, title: `Le traitement ${properties.processing?.title} a terminé correctement mais son journal contient des erreurs` }
  ]
  const urlTemplate = window.parent.location.href
  return `/notify/embed/subscribe?key=${encodeURIComponent(topics.map(t => t.key).join(','))}&title=${encodeURIComponent(topics.map(t => t.title).join(','))}&url-template=${encodeURIComponent(urlTemplate)}&register=false`
})

const webhookLink = computed(() => {
  let link = `${window.location.origin}/api/processings/${properties.processing?._id}/_trigger?key=${webhookKey.value}`
  if (triggerDelay.value > 0) link += `&delay=${triggerDelay.value}`
  return link
})

const confirmRemove = withUiNotif(
  async () => {
    inDelete.value = true

    await $fetch(`${$apiPath}/processings/${properties.processing?._id}`, {
      method: 'DELETE'
    })

    // Redirection après la suppression
    await router.push('/processings')

    showDeleteMenu.value = false
    inDelete.value = false
  },
  'Erreur pendant la suppression du traitement',
  { msg: 'Traitement supprimé avec succès !' }
)

const getWebhookKey = async () => {
  webhookKey.value = await $fetch(`${$apiPath}/processings/${properties.processing?._id}/webhook-key`)
}

const triggerExecution = withUiNotif(
  async () => {
    hasTriggered.value = true
    let link = `${$apiPath}/processings/${properties.processing?._id}/_trigger`
    if (triggerDelay.value > 0) link += `?delay=${triggerDelay.value}`

    await $fetch(link, { method: 'POST' })
    emit('triggered')
    showTriggerMenu.value = false

    hasTriggered.value = false
  },
  'Erreur pendant le déclenchement du traitement',
  { msg: 'Traitement déclenché avec succès !' }
)

watch(showTriggerMenu, async (newValue) => {
  if (newValue && properties.canAdmin) {
    await getWebhookKey()
  }
})
</script>

<style>
</style>
