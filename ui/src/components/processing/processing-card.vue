<template>
  <v-card
    rounded="lg"
    hover
    :to="`/processings/${processing._id}`"
  >
    <v-card-title class="font-weight-bold text-primary">
      {{ processing.title || processing._id }}
    </v-card-title>
    <v-divider />
    <v-card-text class="pa-0">
      <v-list
        density="compact"
        style="background-color: inherit;"
      >
        <v-list-item v-if="pluginFetch.error.value && pluginFetch.error.value?.statusCode !== 404">
          <fetch-error
            :error="pluginFetch.error.value"
          />
        </v-list-item>
        <v-list-item v-else-if="pluginFetch.pending.value">
          <v-progress-circular
            indeterminate
            color="primary"
            size="x-small"
            width="3"
          />
        </v-list-item>
        <v-list-item v-else-if="pluginFetch.error.value?.statusCode">
          <template #prepend>
            <v-icon
              icon="mdi-power-plug"
              color="error"
            />
          </template>
          <span class="text-error">
            {{ 'Supprimé - ' + processing.plugin }}
          </span>
        </v-list-item>
        <v-list-item v-else>
          <template #prepend>
            <v-icon
              icon="mdi-power-plug"
            />
          </template>
          <span>
            {{ pluginFetch.data.value?.customName }}
          </span>
        </v-list-item>

        <template v-if="processing.lastRun">
          <v-list-item v-if="processing.lastRun.status === 'running'">
            <template #prepend>
              <v-progress-circular
                indeterminate
                color="primary"
                size="24"
              />
            </template>
            <span style="padding-left: 1.8rem; display: inline-block;">Exécution commencée {{ format.fromNow(processing.lastRun.startedAt) }}</span>
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'finished'">
            <template #prepend>
              <v-icon
                color="success"
                icon="mdi-check-circle"
              />
            </template>
            <span>Dernière exécution terminée {{ format.fromNow(processing.lastRun.finishedAt) }}</span>
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'error'">
            <template #prepend>
              <v-icon
                color="error"
                icon="mdi-alert"
              />
            </template>
            <span>Dernière exécution en échec {{ format.fromNow(processing.lastRun.finishedAt) }}</span>
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'kill' || processing.lastRun.status === 'killed'">
            <template #prepend>
              <v-icon
                color="accent"
                icon="mdi-stop"
              />
            </template>
            <span>Dernière exécution interrompue {{ format.fromNow(processing.lastRun.finishedAt) }}</span>
          </v-list-item>
        </template>

        <v-list-item v-else>
          <template #prepend>
            <v-icon
              color="primary"
              icon="mdi-information"
            />
          </template>
          <span>Aucune exécution dans l'historique</span>
        </v-list-item>

        <template v-if="processing.nextRun">
          <v-list-item v-if="processing.nextRun.status === 'scheduled'">
            <template #prepend>
              <v-icon
                color="primary"
                icon="mdi-clock"
              />
            </template>
            <span>Prochaine exécution planifiée {{ format.fromNow(processing.nextRun.scheduledAt, true) }}</span>
          </v-list-item>

          <v-list-item v-if="processing.nextRun.status === 'triggered'">
            <template #prepend>
              <v-icon
                color="primary"
                icon="mdi-play-circle"
              />
            </template>
            <span>
              Prochaine exécution déclenchée manuellement {{ format.fromNow(processing.nextRun.createdAt) }}
              <template v-if="processing.nextRun.scheduledAt && processing.nextRun.scheduledAt !== processing.nextRun.createdAt"> - planifiée {{ format.fromNow(processing.nextRun.scheduledAt, true) }}</template>
            </span>
          </v-list-item>
        </template>
      </v-list>
    </v-card-text>
    <v-spacer />
    <v-card-actions
      v-if="showOwner"
      class="pl-3 pt-0"
    >
      <owner-avatar
        :owner="processing.owner"
      />
      <v-spacer />
    </v-card-actions>
  </v-card>
</template>

<script setup>
import OwnerAvatar from '@data-fair/lib-vuetify/owner-avatar.vue'
import useDateFormat from '~/composables/date-format'
import usePluginFetch from '~/composables/use-plugin-fetch'
const format = useDateFormat()

const props = defineProps({
  pluginCustomName: {
    type: String,
    default: null
  },
  processing: {
    type: Object,
    default: null
  },
  showOwner: Boolean
})

const pluginFetch = await usePluginFetch(props.processing.plugin)

</script>

<style>
</style>
