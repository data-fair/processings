<template>
  <v-card
    variant="outlined"
    rounded="lg"
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
        <v-list density="compact">
          <v-list-item>
            <template #prepend>
              <v-icon>mdi-power-plug</v-icon>
            </template>
            <span>{{ plugin ? plugin.fullName : processing.plugin }}</span>
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
              <span>Exécution en cours depuis {{ $filters.fromNow(processing.lastRun.startedAt) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'finished'">
              <template #prepend>
                <v-icon color="success">
                  mdi-check-circle
                </v-icon>
              </template>
              <span>Dernière exécution terminée {{ $filters.fromNow(processing.lastRun.finishedAt) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'error'">
              <template #prepend>
                <v-icon color="error">
                  mdi-alert
                </v-icon>
              </template>
              <span>Dernière exécution en échec {{ $filters.fromNow(processing.lastRun.finishedAt) }}</span>
            </v-list-item>
          </template>

          <v-list-item v-else>
            <span>Aucune exécution dans l'historique</span>
          </v-list-item>

          <template v-if="processing.nextRun">
            <v-list-item v-if="processing.nextRun.status === 'scheduled'">
              <template #prepend>
                <v-icon>mdi-clock</v-icon>
              </template>
              <span>Prochaine exécution planifiée {{ $filters.fromNow(processing.nextRun.scheduledAt, true) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.nextRun.status === 'triggered'">
              <template #prepend>
                <v-icon>mdi-play-circle</v-icon>
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
    <v-card-actions class="pl-3">
      <owner-short
        v-if="showOwner"
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
  plugin: Object,
  processing: Object,
  showOwner: Boolean
})

const hover = ref(false)
</script>

<style>
</style>
