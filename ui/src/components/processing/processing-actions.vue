<!-- eslint-disable vue/no-deprecated-slot-attribute -->
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
          rounded
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
        title="Exécution du traitement"
        variant="elevated"
        :loading="triggerExecution.loading.value ? 'primary' : false"
      >
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
            :disabled="triggerExecution.loading.value"
            @click="showTriggerMenu = false"
          >
            Annuler
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="triggerExecution.loading.value"
            @click="triggerExecution.execute()"
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
        <v-list-item
          v-bind="props"
          rounded
        >
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
        title="Suppression du traitement"
        variant="elevated"
        :loading="confirmRemove.loading.value ? 'warning' : false"
      >
        <v-card-text>
          Voulez-vous vraiment supprimer le traitement "{{ processing?.title }}" et tout son historique ? La suppression est définitive et les données ne pourront pas être récupérées.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="confirmRemove.loading.value"
            @click="showDeleteMenu = false"
          >
            Non
          </v-btn>
          <v-btn
            color="warning"
            variant="flat"
            :loading="confirmRemove.loading.value"
            @click="confirmRemove.execute()"
          >
            Oui
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-menu
      v-if="canAdmin"
      v-model="showChangeOwnerMenu"
      :close-on-content-click="false"
      max-width="500"
    >
      <template #activator="{ props }">
        <v-list-item
          v-bind="props"
          rounded
        >
          <template #prepend>
            <v-icon
              color="warning"
              :icon="mdiAccount"
            />
          </template>
          Changer le proriétaire
        </v-list-item>
      </template>
      <v-card
        rounded="lg"
        title="Changer le proriétaire"
        variant="elevated"
      >
        <v-progress-linear
          v-if="confirmChangeOwner.loading.value"
          indeterminate
          color="warning"
        />
        <v-card-text>
          <owner-pick
            v-model="newOwner"
            v-model:ready="ownersReady"
            message=" "
            other-accounts
          />
          <v-alert
            type="warning"
            title="Opération sensible"
            text="Changer le propriétaire d'un traitement peut avoir des conséquences sur l'execution du traitement."
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="confirmChangeOwner.loading.value"
            @click="showChangeOwnerMenu = false"
          >
            Annuler
          </v-btn>
          <v-btn
            color="warning"
            variant="flat"
            :disabled="!ownersReady"
            :loading="confirmChangeOwner.loading.value"
            @click="confirmChangeOwner.execute()"
          >
            Confirmer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-list-item
      v-if="processing?.config?.dataset?.id"
      :href="`/data-fair/dataset/${processing.config.dataset.id}`"
      target="_blank"
      rounded
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
          rounded
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
        title="Notifications"
        variant="elevated"
      >
        <v-card-text class="py-0 px-3">
          <d-frame
            :src="notifUrl"
            resize
          >
            <div slot="loader">
              <v-skeleton-loader type="paragraph" />
            </div>
          </d-frame>
        </v-card-text>
      </v-card>
    </v-menu>
  </v-list>
</template>

<script setup lang="ts">
import OwnerPick from '@data-fair/lib-vuetify/owner-pick.vue'
import { Account } from '@data-fair/lib-vue/session'
import '@data-fair/frame/lib/d-frame.js'

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

const router = useRouter()
const session = useSessionAuthenticated()

const showDeleteMenu = ref(false)
const showNotifMenu = ref(false)
const showTriggerMenu = ref(false)
const showChangeOwnerMenu = ref(false)
const triggerDelay = ref(0)
const webhookKey = ref('')
const ownersReady = ref(false)
const newOwner = ref<Account>(session.state.account)

const activeAccount = computed(() => session.state.account)

const notifUrl = computed(() => {
  const topics = [
    { key: `processings:processing-finish-ok:${properties.processing?._id ?? ''}`, title: `Le traitement ${properties.processing?.title ?? ''} a terminé avec succès` },
    { key: `processings:processing-finish-error:${properties.processing?._id}`, title: `Le traitement ${properties.processing?.title} a terminé en échec` },
    { key: `processings:processing-log-error:${properties.processing?._id}`, title: `Le traitement ${properties.processing?.title} a terminé correctement mais son journal contient des erreurs` }
  ]
  const urlTemplate = window.parent.location.href
  return `/events/embed/subscribe?key=${encodeURIComponent(topics.map(t => t.key).join(','))}&title=${encodeURIComponent(topics.map(t => t.title).join(','))}&url-template=${encodeURIComponent(urlTemplate)}&register=false`
})

const webhookLink = computed(() => {
  let link = `${window.location.origin}/processings/api/v1/processings/${properties.processing?._id}/_trigger?key=${webhookKey.value}`
  if (triggerDelay.value > 0) link += `&delay=${triggerDelay.value}`
  return link
})

const confirmChangeOwner = useAsyncAction(
  async () => {
    await $fetch(`/processings/${properties.processing?._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ owner: newOwner.value })
    })
    showChangeOwnerMenu.value = false
  }
)

const confirmRemove = useAsyncAction(
  async () => {
    await $fetch(`/processings/${properties.processing?._id}`, {
      method: 'DELETE'
    })
    await router.replace('/processings') // Redirect after deleting
    showDeleteMenu.value = false
  },
  {
    error: 'Erreur lors de la suppression du traitement',
    success: 'Traitement supprimé !'
  }
)

const getWebhookKey = async () => {
  webhookKey.value = await $fetch(`/processings/${properties.processing?._id}/webhook-key`)
}

const triggerExecution = useAsyncAction(
  async () => {
    let link = `/processings/${properties.processing?._id}/_trigger`
    if (triggerDelay.value > 0) link += `?delay=${triggerDelay.value}`

    await $fetch(link, { method: 'POST' })
    emit('triggered')
    showTriggerMenu.value = false
  },
  {
    error: 'Erreur lors de le déclenchement du traitement',
    success: 'Traitement déclenché !'
  }
)

watch(showTriggerMenu, async (newValue) => {
  if (newValue && properties.canAdmin) {
    await getWebhookKey()
  }
})
</script>

<style>
</style>
