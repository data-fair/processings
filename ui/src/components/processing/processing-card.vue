<template>
  <v-card
    class="h-100"
    :to="`/processings/${processing._id}`"
  >
    <v-card-item class="text-primary">
      <!-- Processing title -->
      <template #title>
        <span class="font-weight-bold">
          {{ processing.title || processing._id }}
        </span>
        <v-tooltip
          v-if="processing.title && processing.title.length > 15"
          activator="parent"
          location="top left"
          open-delay="300"
          :text="processing.title"
        />
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
            {{ 'Supprimé - ' + processing.plugin }}
          </span>
        </v-list-item>
        <v-list-item v-else>
          <template #prepend>
            <v-icon :icon="mdiPowerPlug" />
          </template>
          <span>
            {{ pluginFetch.data.value?.metadata.name }}
          </span>
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
            Exécution commencée {{ dayjs(processing.lastRun.startedAt).fromNow() }}
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'finished'">
            <template #prepend>
              <v-icon
                color="success"
                :icon="mdiCheckCircle"
              />
            </template>
            Dernière exécution terminée {{ dayjs(processing.lastRun.finishedAt).fromNow() }}
            <br>Durée : {{ dayjs(processing.lastRun.finishedAt).from(processing.lastRun.startedAt, true) }}
          </v-list-item>

          <v-list-item v-if="processing.lastRun.status === 'error'">
            <template #prepend>
              <v-icon
                color="error"
                :icon="mdiAlert"
              />
            </template>
            Dernière exécution en échec {{ dayjs(processing.lastRun.finishedAt).fromNow() }}
            <br>Durée : {{ dayjs(processing.lastRun.finishedAt).from(processing.lastRun.startedAt, true) }}
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

        <!-- Next run -->
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

        <v-list-item>
          <template #prepend>
            <v-icon
              :color="processing.active ? 'success' : 'error'"
              :icon="processing.active ? mdiToggleSwitch : mdiToggleSwitchOff"
            />
          </template>
          {{ processing.active ? 'Actif' : 'Inactif' }}
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import ownerAvatar from '@data-fair/lib-vuetify/owner-avatar.vue'
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

const pluginFetch = usePluginFetch(props.processing.plugin)

</script>
