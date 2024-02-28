<template>
  <v-card
    variant="outlined"
    rounded="0"
    :elevation="hover ? 4 : 0"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <nuxt-link
      :to="`/processings/${processing._id}`"
      style="text-decoration:none"
    >
      <v-card-title>
        <span
          class="font-weight-bold"
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
              <span>Exécution en cours depuis {{ processing.lastRun.startedAt | fromNow }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'finished'">
              <template #prepend>
                <v-icon color="success">
                  mdi-check-circle
                </v-icon>
              </template>
              <span>Dernière exécution terminée {{ processing.lastRun.finishedAt | fromNow }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'error'">
              <template #prepend>
                <v-icon color="error">
                  mdi-alert
                </v-icon>
              </template>
              <span>Dernière exécution en échec {{ processing.lastRun.finishedAt | fromNow }}</span>
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
              <span>Prochaine exécution planifiée {{ processing.nextRun.scheduledAt | fromNow(true) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.nextRun.status === 'triggered'">
              <template #prepend>
                <v-icon>mdi-play-circle</v-icon>
              </template>
              <span>
                Prochaine exécution déclenchée manuellement {{ processing.nextRun.createdAt | fromNow }}
                <template v-if="processing.nextRun.scheduledAt && processing.nextRun.scheduledAt !== processing.nextRun.createdAt"> - planifiée {{ processing.nextRun.scheduledAt | fromNow(true) }}</template>
              </span>
            </v-list-item>
          </template>
        </v-list>
      </v-card-text>
    </nuxt-link>
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

const props = defineProps({
  processing: Object,
  showOwner: Boolean,
  plugin: Object
})

const hover = ref(false)
</script>

<style scoped>
</style>
