<template>
  <v-card
    variant="outlined"
    rounded="lg"
    border="md"
    :elevation="hover ? 4 : 0"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <NuxtLink
      :to="`/processings/${processing._id}`"
      style="text-decoration:none"
    >
      <v-card-title>
        <span
          class="font-weight-bold text-primary"
          style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
        >
          {{ processing.title || processing._id }}
        </span>
      </v-card-title>
      <v-divider />
      <v-card-text
        style="min-height: 96px;"
        class="pa-0"
      >
        <v-list
          bg-color="transparent"
          density="compact"
        >
          <v-list-item>
            <template #prepend>
              <v-icon
                icon="mdi-power-plug"
              />
            </template>
            <span>{{ plugin ? plugin.customName : processing.plugin }}</span>
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
              <span style="padding-left: 1.8rem; display: inline-block;">Exécution commencée {{ $filters.fromNow(processing.lastRun.startedAt) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'finished'">
              <template #prepend>
                <v-icon
                  color="success"
                  icon="mdi-check-circle"
                />
              </template>
              <span>Dernière exécution terminée {{ $filters.fromNow(processing.lastRun.finishedAt) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'error'">
              <template #prepend>
                <v-icon
                  color="error"
                  icon="mdi-alert"
                />
              </template>
              <span>Dernière exécution en échec {{ $filters.fromNow(processing.lastRun.finishedAt) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'kill' || processing.lastRun.status === 'killed'">
              <template #prepend>
                <v-icon
                  color="accent"
                  icon="mdi-stop"
                />
              </template>
              <span>Dernière exécution interrompue {{ $filters.fromNow(processing.lastRun.finishedAt) }}</span>
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
              <span>Prochaine exécution planifiée {{ $filters.fromNow(processing.nextRun.scheduledAt, true) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.nextRun.status === 'triggered'">
              <template #prepend>
                <v-icon
                  color="primary"
                  icon="mdi-play-circle"
                />
              </template>
              <span>
                Prochaine exécution déclenchée manuellement {{ $filters.fromNow(processing.nextRun.createdAt) }}
                <template v-if="processing.nextRun.scheduledAt && processing.nextRun.scheduledAt !== processing.nextRun.createdAt"> - planifiée {{ $filters.fromNow(processing.nextRun.scheduledAt, true) }}</template>
              </span>
            </v-list-item>
          </template>
        </v-list>
      </v-card-text>
    </NuxtLink>
    <v-card-actions
      v-if="showOwner"
      class="pl-3"
    >
      <owner-short
        :owner="processing.owner"
      />
      <v-spacer />
    </v-card-actions>
  </v-card>
</template>

<script setup>
import OwnerShort from '~/components/owner/owner-short.vue'
import { ref } from 'vue'

defineProps({
  plugin: {
    type: Object,
    default: null
  },
  processing: {
    type: Object,
    default: null
  },
  showOwner: Boolean
})

const hover = ref(false)
</script>

<style>
</style>
