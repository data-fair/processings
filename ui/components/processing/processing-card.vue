<template>
  <v-card
    outlined
    tile
    :elevation="hover ? 4 : 0"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <nuxt-link
      :to="`/processings/${processing._id}`"
      style="text-decoration:none"
    >
      <v-card-title>
        <span class="font-weight-bold" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          {{ processing.title || processing._id }}
        </span>
      </v-card-title>
      <v-divider />
      <v-card-text style="min-height: 96px;" class="pa-0">
        <v-list dense>
          <v-list-item>
            <v-list-item-avatar>
              <v-icon>mdi-power-plug</v-icon>
            </v-list-item-avatar>
            <span>{{ plugin ? plugin.fullName : processing.plugin }}</span>
          </v-list-item>

          <template v-if="processing.lastRun">
            <v-list-item v-if="processing.lastRun.status === 'running'">
              <v-list-item-avatar>
                <v-progress-circular indeterminate color="primary" size="24" />
              </v-list-item-avatar>
              <span>Exécution en cours depuis {{ processing.lastRun.startedAt | fromNow }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'finished'">
              <v-list-item-avatar>
                <v-icon color="success">mdi-check-circle</v-icon>
              </v-list-item-avatar>
              <span>Dernière exécution terminée {{ processing.lastRun.finishedAt | fromNow }}</span>
            </v-list-item>

            <v-list-item v-if="processing.lastRun.status === 'error'">
              <v-list-item-avatar>
                <v-icon color="error">mdi-alert</v-icon>
              </v-list-item-avatar>
              <span>Dernière exécution en échec {{ processing.lastRun.finishedAt | fromNow }}</span>
            </v-list-item>
          </template>

          <v-list-item v-else>
            <v-list-item-avatar />
            <span>Aucune exécution dans l'historique</span>
          </v-list-item>

          <template v-if="processing.nextRun">
            <v-list-item v-if="processing.nextRun.status === 'scheduled'">
              <v-list-item-avatar>
                <v-icon>mdi-clock</v-icon>
              </v-list-item-avatar>
              <span>Prochaine exécution planifiée {{ processing.nextRun.scheduledAt | fromNow(true) }}</span>
            </v-list-item>

            <v-list-item v-if="processing.nextRun.status === 'triggered'">
              <v-list-item-avatar>
                <v-icon>mdi-play-circle</v-icon>
              </v-list-item-avatar>
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
      <owner-short v-if="showOwner" :owner="processing.owner" />
      <v-spacer />
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref } from 'vue'
import OwnerShort from '../owner/owner-short.vue'

const props = defineProps({
  processing: Object,
  showOwner: Boolean,
  plugin: Object
})

const hover = ref(false)
</script>

<style scoped>
</style>
