<template>
  <v-card
    class="h-100"
    :to="`/processings/${processing._id}`"
  >
    <v-card-item class="text-primary">
      <!-- Processing title -->
      <template #title>
        <span
          :title="processing.title"
          class="font-weight-bold"
        >
          {{ processing.title }}
        </span>
      </template>

      <!-- Owner -->
      <template #append>
        <owner-avatar
          v-if="showOwner"
          :owner="processing.owner"
        />
      </template>
    </v-card-item>
    <v-divider />
    <v-card-text class="pa-0">
      <v-list
        density="compact"
        style="background-color: inherit;"
      >
        <!-- Plugin name -->
        <v-list-item v-if="pluginFetch.loading.value">
          <v-progress-circular
            indeterminate
            color="primary"
            size="small"
            width="3"
          />
        </v-list-item>
        <v-list-item v-else-if="pluginFetch.error.value?.statusCode">
          <template #prepend>
            <v-icon
              :icon="mdiPowerPlug"
              color="error"
            />
          </template>
          <span class="text-error">
            {{ t('deleted') + ' - ' + processing.pluginId }}
          </span>
        </v-list-item>
        <v-list-item v-else>
          <template #prepend>
            <v-icon :icon="mdiPowerPlug" />
          </template>
          {{ pluginFetch.data.value?.title?.fr ?? pluginFetch.data.value?.title?.en ?? pluginFetch.data.value?.name ?? processing.pluginId }}
        </v-list-item>

        <!-- Linked dataset -->
        <v-list-item
          v-if="processing.config?.dataset?.id"
        >
          <template #prepend>
            <v-icon
              color="primary"
              :icon="mdiDatabase"
            />
          </template>
          {{ processing.config.dataset.title || processing.config.dataset.id }}
        </v-list-item>

        <!-- Last run -->
        <template v-if="processing.lastRun">
          <v-list-item v-if="processing.lastRun.status === 'running'">
            <template #prepend>
              <v-progress-circular
                indeterminate
                color="primary"
                size="small"
                class="mr-7"
              />
            </template>
            {{ t('runStarted') }} {{ dayjs(processing.lastRun.startedAt).fromNow() }}
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'finished'">
            <template #prepend>
              <v-icon
                color="success"
                :icon="mdiCheckCircle"
              />
            </template>
            {{ t('lastRunFinished') }} {{ dayjs(processing.lastRun.finishedAt).fromNow() }}
            <br>{{ t('duration') }} {{ dayjs(processing.lastRun.finishedAt).from(processing.lastRun.startedAt, true) }}
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'error'">
            <template #prepend>
              <v-icon
                color="error"
                :icon="mdiAlert"
              />
            </template>
            {{ t('lastRunError') }} {{ dayjs(processing.lastRun.finishedAt).fromNow() }}
            <br>{{ t('duration') }} {{ dayjs(processing.lastRun.finishedAt).from(processing.lastRun.startedAt, true) }}
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'kill' || processing.lastRun.status === 'killed'">
            <template #prepend>
              <v-icon
                color="accent"
                :icon="mdiStop"
              />
            </template>
            <span>{{ t('lastRunKilled') }} {{ dayjs(processing.lastRun.finishedAt).fromNow() }}</span>
          </v-list-item>
        </template>
        <v-list-item v-else>
          <template #prepend>
            <v-icon
              color="primary"
              :icon="mdiInformation"
            />
          </template>
          <span>{{ t('noRuns') }}</span>
        </v-list-item>

        <!-- Next run -->
        <template v-if="processing.nextRun">
          <v-list-item v-if="processing.nextRun.status === 'scheduled'">
            <template #prepend>
              <v-icon
                color="primary"
                :icon="mdiClock"
              />
            </template>
            <span>{{ t('nextRunScheduled') }} {{ dayjs(processing.nextRun.scheduledAt).fromNow() }}</span>
          </v-list-item>

          <v-list-item v-if="processing.nextRun.status === 'triggered'">
            <template #prepend>
              <v-icon
                color="primary"
                :icon="mdiPlayCircle"
              />
            </template>
            <span>
              {{ t('nextRunTriggered') }} {{ dayjs(processing.nextRun.createdAt).fromNow()
              }}
              <template
                v-if="processing.nextRun.scheduledAt && processing.nextRun.scheduledAt !== processing.nextRun.createdAt"
              >
                - {{ t('scheduled') }} {{ dayjs(processing.nextRun.scheduledAt).fromNow() }}
              </template>
            </span>
          </v-list-item>
        </template>

        <v-list-item>
          <template #prepend>
            <v-icon
              :color="processing.active ? 'success' : 'error'"
              :icon="processing.active ? mdiToggleSwitch : mdiToggleSwitchOff"
            />
          </template>
          {{ processing.active ? t('active') : t('inactive') }}
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import ownerAvatar from '@data-fair/lib-vuetify/owner-avatar.vue'
const { t } = useI18n()
const { dayjs } = useLocaleDayjs()

const props = defineProps({
  pluginName: {
    type: String,
    default: null
  },
  processing: {
    type: Object,
    default: null
  },
  showOwner: Boolean
})

const pluginFetch = usePluginFetch(props.processing.pluginId)

</script>

<i18n lang="yaml">
  en:
    deleted: Deleted
    runStarted: Run started
    lastRunFinished: Last run finished
    duration: "Duration:"
    lastRunError: Last run failed
    lastRunKilled: Last run interrupted
    noRuns: No runs in history
    nextRunScheduled: Next run scheduled
    nextRunTriggered: Next run triggered manually
    scheduled: scheduled
    active: Active
    inactive: Inactive

  fr:
    deleted: Supprimé
    runStarted: Exécution commencée
    lastRunFinished: Dernière exécution terminée
    duration: "Durée :"
    lastRunError: Dernière exécution en échec
    lastRunKilled: Dernière exécution interrompue
    noRuns: Aucune exécution dans l'historique
    nextRunScheduled: Prochaine exécution planifiée
    nextRunTriggered: Prochaine exécution déclenchée manuellement
    scheduled: planifiée
    active: Actif
    inactive: Inactif

</i18n>
