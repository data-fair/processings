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
        <v-list-item v-if="pluginFetch.loading.value">
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
              :icon="mdiPowerPlug"
              color="error"
            />
          </template>
          <span class="text-error">
            {{ 'Supprimé - ' + processing.plugin }}
          </span>
        </v-list-item>
        <v-list-item v-else>
          <template #prepend>
            <v-icon :icon="mdiPowerPlug" />
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
            <span style="padding-left: 1.8rem; display: inline-block;">
              Exécution commencée {{ dayjs(processing.lastRun.startedAt).fromNow() }}
            </span>
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'finished'">
            <template #prepend>
              <v-icon
                color="success"
                :icon="mdiCheckCircle"
              />
            </template>
            <span>Dernière exécution terminée {{ dayjs(processing.lastRun.finishedAt).fromNow() }}</span>
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'error'">
            <template #prepend>
              <v-icon
                color="error"
                :icon="mdiAlert"
              />
            </template>
            <span>Dernière exécution en échec {{ dayjs(processing.lastRun.finishedAt).fromNow() }}</span>
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'kill' || processing.lastRun.status === 'killed'">
            <template #prepend>
              <v-icon
                color="accent"
                :icon="mdiStop"
              />
            </template>
            <span>Dernière exécution interrompue {{ dayjs(processing.lastRun.finishedAt).fromNow() }}</span>
          </v-list-item>
        </template>

        <v-list-item v-else>
          <template #prepend>
            <v-icon
              color="primary"
              :icon="mdiInformation"
            />
          </template>
          <span>Aucune exécution dans l'historique</span>
        </v-list-item>

        <template v-if="processing.nextRun">
          <v-list-item v-if="processing.nextRun.status === 'scheduled'">
            <template #prepend>
              <v-icon
                color="primary"
                :icon="mdiClock"
              />
            </template>
            <span>Prochaine exécution planifiée {{ dayjs(processing.nextRun.scheduledAt).fromNow() }}</span>
          </v-list-item>

          <v-list-item v-if="processing.nextRun.status === 'triggered'">
            <template #prepend>
              <v-icon
                color="primary"
                :icon="mdiPlayCircle"
              />
            </template>
            <span>
              Prochaine exécution déclenchée manuellement {{ dayjs(processing.nextRun.createdAt).fromNow()
              }}
              <template
                v-if="processing.nextRun.scheduledAt && processing.nextRun.scheduledAt !== processing.nextRun.createdAt"
              >
                - planifiée {{ dayjs(processing.nextRun.scheduledAt).fromNow() }}
              </template>
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
      <owner-avatar :owner="processing.owner" />
      <v-spacer />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
const { dayjs } = useLocaleDayjs()

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

const pluginFetch = usePluginFetch(props.processing.plugin)
</script>
