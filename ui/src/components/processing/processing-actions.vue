<template>
  <!-- Execute -->
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
        <span>{{ t('execute') }}</span>
      </v-list-item>
      <v-progress-linear
        v-if="edited"
        indeterminate
        color="primary"
      />
    </template>
    <v-card
      :title="t('executionTitle')"
      :loading="triggerExecution.loading.value ? 'primary' : false"
    >
      <v-card-text class="py-0">
        <p v-if="canAdmin">
          {{ t('webhookDescription') }}
          <br><code>{{ webhookLink }}</code>
        </p>
        <v-text-field
          v-model="triggerDelay"
          class="py-4"
          type="number"
          :label="t('delayLabel')"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="triggerExecution.loading.value"
          @click="showTriggerMenu = false"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="triggerExecution.loading.value"
          @click="triggerExecution.execute()"
        >
          {{ t('triggerManually') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>

  <!-- Duplicate -->
  <v-menu
    v-if="canAdmin"
    v-model="showDuplicateMenu"
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
            color="primary"
            :icon="mdiContentDuplicate"
          />
        </template>
        {{ t('duplicate') }}
      </v-list-item>
    </template>
    <v-card
      :title="t('duplicateTitle')"
      :loading="confirmDuplicate.loading.value ? 'primary' : false"
    >
      <v-card-text>
        {{ t('duplicateDescription', { title: processing?.title }) }}
        <v-text-field
          v-model="duplicateTitle"
          :label="t('newProcessingTitleLabel')"
          class="mt-4"
          :placeholder="processing?.title + ' ' + t('copy')"
          hide-details="auto"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="confirmDuplicate.loading.value"
          @click="showDuplicateMenu = false"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="confirmDuplicate.loading.value"
          @click="confirmDuplicate.execute()"
        >
          {{ t('duplicate') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>

  <!-- Delete -->
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
        {{ t('delete') }}
      </v-list-item>
    </template>
    <v-card
      :title="t('deleteTitle')"
      :loading="confirmRemove.loading.value ? 'warning' : false"
    >
      <v-card-text>
        {{ t('deleteDescription', { title: processing?.title }) }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="confirmRemove.loading.value"
          @click="showDeleteMenu = false"
        >
          {{ t('no') }}
        </v-btn>
        <v-btn
          color="warning"
          variant="flat"
          :loading="confirmRemove.loading.value"
          @click="confirmRemove.execute()"
        >
          {{ t('yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>

  <!-- Change owner -->
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
        {{ t('changeOwner') }}
      </v-list-item>
    </template>
    <v-card
      :title="t('changeOwner')"
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
          :title="t('sensitiveOperation')"
          :text="t('changeOwnerWarning')"
          variant="outlined"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="confirmChangeOwner.loading.value"
          @click="showChangeOwnerMenu = false"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-btn
          color="warning"
          variant="flat"
          :disabled="!ownersReady"
          :loading="confirmChangeOwner.loading.value"
          @click="confirmChangeOwner.execute()"
        >
          {{ t('confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>

  <!-- Dataset link -->
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
    {{ t('viewDataset') }}
  </v-list-item>

  <!-- Documentation link -->
  <v-list-item
    v-if="metadata?.documentation"
    :href="metadata.documentation"
    target="_blank"
    rounded
  >
    <template #prepend>
      <v-icon
        color="primary"
        :icon="mdiBookOpenVariant"
      />
    </template>
    {{ t('tutorial') }}
  </v-list-item>

  <!-- API link -->
  <v-list-item
    v-if="session.state.user.adminMode"
    :href="`${origin}/openapi-viewer?urlType=processingsId&id=${processing?._id}`"
    target="_blank"
    rounded
  >
    <template #prepend>
      <v-icon
        color="primary"
        :icon="mdiCloud"
      />
    </template>
    {{ t('useApi') }}
  </v-list-item>

  <!-- Notifications menu -->
  <v-menu
    v-if="eventsSubscribeUrl && canSubscribeNotif"
    v-model="showNotifMenu"
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
            color="primary"
            :icon="mdiBell"
          />
        </template>
        {{ t('notifications') }}
      </v-list-item>
    </template>
    <v-card
      :title="t('notifications')"
    >
      <v-card-text class="pa-0">
        <d-frame :src="eventsSubscribeUrl" />
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import OwnerPick from '@data-fair/lib-vuetify/owner-pick.vue'
import { Account } from '@data-fair/lib-vue/session'
import '@data-fair/frame/lib/d-frame.js'

const emit = defineEmits(['triggered'])

const { canAdmin, canExec, edited, metadata, processing, processingSchema } = defineProps<{
  canAdmin: boolean,
  canExec: boolean,
  edited: boolean,
  metadata: Record<string, any> | undefined,
  processing: Record<string, any>,
  processingSchema: Record<string, any>,
}>()

const { t } = useI18n()
const router = useRouter()
const session = useSessionAuthenticated()

const origin = ref(window.location.origin)
const showDeleteMenu = ref(false)
const showNotifMenu = ref(false)
const showTriggerMenu = ref(false)
const showChangeOwnerMenu = ref(false)
const showDuplicateMenu = ref(false)
const triggerDelay = ref(0)
const webhookKey = ref('')
const ownersReady = ref(false)
const newOwner = ref<Account>(session.state.account)
const duplicateTitle = ref(`${processing.title} ${t('copy')}`)

const canSubscribeNotif = computed(() => processing?.owner.type === session.state.account.type && processing?.owner.id === session.state.account.id)
const ownerString = computed(() => `${processing?.owner.type}:${processing?.owner.id}${processing?.owner.department ? ':' + processing?.owner.department : ''}`)

const eventsSubscribeUrl = computed(() => {
  const topics = [
    { key: `processings:processing-finish-ok:${processing?._id ?? ''}`, title: t('notifFinishOk', { title: processing?.title ?? '' }), sender: ownerString.value },
    { key: `processings:processing-finish-error:${processing?._id}`, title: t('notifFinishError', { title: processing?.title }), sender: ownerString.value },
    { key: `processings:processing-log-error:${processing?._id}`, title: t('notifLogError', { title: processing?.title }), sender: ownerString.value },
    { key: `processings:processing-disabled:${processing?._id}`, title: t('notifDisabled', { title: processing?.title }), sender: ownerString.value }
  ]
  const urlTemplate = window.parent.location.href
  return `/events/embed/subscribe?key=${encodeURIComponent(topics.map(tp => tp.key).join(','))}&title=${encodeURIComponent(topics.map(tp => tp.title).join(','))}&url-template=${encodeURIComponent(urlTemplate)}&register=false&sender=${encodeURIComponent(topics.map(tp => tp.sender).join(','))}`
})

const webhookLink = computed(() => {
  let link = `${window.location.origin}/processings/api/v1/processings/${processing?._id}/_trigger?key=${webhookKey.value}`
  if (triggerDelay.value > 0) link += `&delay=${triggerDelay.value}`
  return link
})

const confirmDuplicate = useAsyncAction(
  async () => {
    if (!processing) return

    const newProcessing = {
      owner: processing.owner,
      plugin: processing.plugin,
      title: duplicateTitle.value || `${processing.title} ${t('copy')}`,
      config: processing.config,
      permissions: processing.permissions,
      scheduling: processing.scheduling
    }

    const created = await $fetch('/processings', {
      method: 'POST',
      body: JSON.stringify(newProcessing)
    })

    await router.push(`/processings/${created._id}`)
    router.go(0) // Refresh the page to get the new processing
    showDuplicateMenu.value = false
  },
  {
    error: t('duplicateError'),
    success: t('duplicateSuccess')
  }
)

const confirmChangeOwner = useAsyncAction(
  async () => {
    await $fetch(`/processings/${processing?._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ owner: newOwner.value })
    })
    showChangeOwnerMenu.value = false
  }
)

const confirmRemove = useAsyncAction(
  async () => {
    await $fetch(`/processings/${processing?._id}`, {
      method: 'DELETE'
    })
    await router.replace('/processings') // Redirect after deleting
    showDeleteMenu.value = false
  },
  {
    error: t('deleteError'),
    success: t('deleteSuccess')
  }
)

const getWebhookKey = async () => {
  webhookKey.value = await $fetch(`/processings/${processing?._id}/webhook-key`)
}

const triggerExecution = useAsyncAction(
  async () => {
    let link = `/processings/${processing?._id}/_trigger`
    if (triggerDelay.value > 0) link += `?delay=${triggerDelay.value}`

    await $fetch(link, { method: 'POST' })
    emit('triggered')
    showTriggerMenu.value = false
  },
  {
    error: t('triggerError'),
    success: t('triggerSuccess')
  }
)

watch(showTriggerMenu, async (newValue) => {
  if (newValue && canAdmin) {
    await getWebhookKey()
  }
})
</script>

<i18n lang="yaml">
en:
  execute: Execute
  executionTitle: Processing execution
  webhookDescription: "You can trigger an execution without being connected to the platform by sending an HTTP POST request to this secure URL:"
  delayLabel: Apply a delay in seconds
  cancel: Cancel
  triggerManually: Trigger manually
  duplicate: Duplicate
  duplicateTitle: Processing duplication
  duplicateDescription: "You are about to create a copy of the processing \"{title}\"."
  newProcessingTitleLabel: New processing title
  copy: (copy)
  delete: Delete
  deleteTitle: Processing deletion
  deleteDescription: "Do you really want to delete the processing \"{title}\" and all its history? Deletion is permanent and data cannot be recovered."
  no: "No"
  yes: "Yes"
  changeOwner: Change owner
  sensitiveOperation: Sensitive operation
  changeOwnerWarning: Changing the owner of a processing can have consequences on the processing execution.
  confirm: Confirm
  viewDataset: View the dataset
  tutorial: Tutorial
  useApi: Use the API
  notifications: Notifications
  notifFinishOk: "Processing {title} finished without errors"
  notifFinishError: "Processing {title} failed"
  notifLogError: "Processing {title} finished successfully but its log contains errors"
  notifDisabled: "Processing {title} was disabled because it failed too many times in a row"
  duplicateError: Error while duplicating the processing
  duplicateSuccess: Processing duplicated!
  deleteError: Error while deleting the processing
  deleteSuccess: Processing deleted!
  triggerError: Error while triggering the processing
  triggerSuccess: Processing triggered!

fr:
  execute: Exécuter
  executionTitle: Exécution du traitement
  webhookDescription: "Vous pouvez déclencher une exécution sans être connecté à la plateforme en envoyant une requête HTTP POST à cette URL sécurisée :"
  delayLabel: Appliquer un délai en secondes
  cancel: Annuler
  triggerManually: Déclencher manuellement
  duplicate: Dupliquer
  duplicateTitle: Duplication du traitement
  duplicateDescription: "Vous êtes sur le point de créer une copie du traitement \"{title}\"."
  newProcessingTitleLabel: Titre du nouveau traitement
  copy: (copie)
  delete: Supprimer
  deleteTitle: Suppression du traitement
  deleteDescription: "Voulez-vous vraiment supprimer le traitement \"{title}\" et tout son historique ? La suppression est définitive et les données ne pourront pas être récupérées."
  no: Non
  yes: Oui
  changeOwner: Changer le propriétaire
  sensitiveOperation: Opération sensible
  changeOwnerWarning: Changer le propriétaire d'un traitement peut avoir des conséquences sur l'execution du traitement.
  confirm: Confirmer
  viewDataset: Voir le jeu de données
  tutorial: Tutoriel
  useApi: Utiliser l'API
  notifications: Notifications
  notifFinishOk: "Le traitement {title} s'est terminé sans erreurs"
  notifFinishError: "Le traitement {title} a échoué"
  notifLogError: "Le traitement {title} s'est terminé correctement mais son journal contient des erreurs"
  notifDisabled: "Le traitement {title} a été désactivé car il a échoué trop de fois à la suite"
  duplicateError: Erreur lors de la duplication du traitement
  duplicateSuccess: Traitement dupliqué !
  deleteError: Erreur lors de la suppression du traitement
  deleteSuccess: Traitement supprimé !
  triggerError: Erreur lors du déclenchement du traitement
  triggerSuccess: Traitement déclenché !
</i18n>
