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
          :disabled="!processing.active"
        >
          <template #prepend>
            <v-icon color="primary">
              mdi-play
            </v-icon>
          </template>
          <span>Exécuter</span>
        </v-list-item>
      </template>
      <v-card variant="outlined">
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
            @click="triggerExecution"
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
      <v-card variant="outlined">
        <v-card-title primary-title>
          Suppression du traitement
        </v-card-title>
        <v-card-text>
          Voulez-vous vraiment supprimer le traitement "{{ processing.title }}" et tout son historique ? La suppression est définitive et les données ne pourront pas être récupérées.
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
      v-if="processing.config && processing.config.dataset && processing.config.dataset.id"
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
      v-if="notifUrl && processing.owner.type === activeAccount.type && processing.owner.id === activeAccount.id && !activeAccount.department"
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
      <v-card variant="outlined">
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
import VIframe from '@koumoul/v-iframe'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '~/store'

const props = defineProps({
  processing: Object,
  canAdmin: Boolean,
  canExec: Boolean
})

const store = useStore()
const router = useRouter()

const showTriggerMenu = ref(false)
const showDeleteMenu = ref(false)
const showNotifMenu = ref(false)
const triggerDelay = ref(0)
const webhookKey = ref(null)

const env = computed(() => store.state.env)
const activeAccount = computed(() => store.getters['session/activeAccount'])

const notifUrl = computed(() => {
  if (!env.value.notifyUrl || !props.processing.owner || props.processing.owner.type !== activeAccount.value.type || props.processing.owner.id !== activeAccount.value.id || activeAccount.value.department) return null
  const topics = [
    `processings:processing-finish-ok:${props.processing._id}`,
    `processings:processing-finish-error:${props.processing._id}`,
    `processings:processing-log-error:${props.processing._id}`
  ].map(key => `${key},${props.processing.title}`).join(';')
  return `${env.value.notifyUrl}/embed/subscribe?topics=${encodeURIComponent(topics)}`
})

const webhookLink = computed(() => {
  return `${env.value.publicUrl}/api/v1/processings/${props.processing._id}/_trigger?key=${webhookKey.value}&delay=${triggerDelay.value}`
})

const triggerExecution = async () => {
  try {
    await $fetch(`${env.value.publicUrl}/api/v1/processings/${props.processing._id}/_trigger`, {
      method: 'POST',
      body: { delay: triggerDelay.value }
    })
    showTriggerMenu.value = false
  } catch (error) {
    console.error('Error triggering processing:', error)
  }
}

const confirmRemove = async () => {
  try {
    await $fetch(`${env.value.publicUrl}/api/v1/processings/${props.processing._id}`, {
      method: 'DELETE'
    })
    router.push('/processings')
    showDeleteMenu.value = false
  } catch (error) {
    console.error('Error deleting processing:', error)
  }
}

const getWebhookKey = async () => {
  try {
    const response = await $fetch(`${env.value.publicUrl}/api/v1/processings/${props.processing._id}/webhook-key`)
    webhookKey.value = response
  } catch (error) {
    console.error('Error fetching webhook key:', error)
  }
}

watch(showTriggerMenu, async (newValue) => {
  if (newValue && canAdmin.value) {
    await getWebhookKey()
  }
})
</script>

<style scoped>
</style>
