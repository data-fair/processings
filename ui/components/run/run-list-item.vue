<template>
  <v-list-item :to="link ? `/runs/${run._id}` : ''">
    <template v-if="run.status === 'running'">
      <v-list-item-avatar>
        <v-progress-circular indeterminate color="primary" size="24" />
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>démarrée {{ run.startedAt | fromNow }}</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'finished'">
      <v-list-item-avatar>
        <v-icon color="success">mdi-check-circle</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>terminée - {{ run.finishedAt | date }}</v-list-item-title>
        <v-list-item-subtitle>durée : {{ duration(run.startedAt, run.finishedAt) }}</v-list-item-subtitle>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'error'">
      <v-list-item-avatar>
        <v-icon color="error">mdi-alert</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>en échec - {{ run.finishedAt | date }}</v-list-item-title>
        <v-list-item-subtitle>durée : {{ duration(run.startedAt, run.finishedAt) }}</v-list-item-subtitle>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'scheduled'">
      <v-list-item-avatar>
        <v-icon>mdi-clock</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>planifiée - {{ run.scheduledAt | date }}</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'triggered'">
      <v-list-item-avatar>
        <v-icon>mdi-play-circle</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>déclenchée manuellement {{ run.createdAt | fromNow }}</v-list-item-title>
        <v-list-item-subtitle v-if="run.scheduledAt && run.scheduledAt !== run.createdAt">
          planifiée {{ run.scheduledAt | fromNow(true) }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'kill'">
      <v-list-item-avatar>
        <v-icon color="warning">mdi-stop</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>interruption demandée</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'killed'">
      <v-list-item-avatar>
        <v-icon color="warning">mdi-stop</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>interrompue manuellement - {{ run.finishedAt | date }}</v-list-item-title>
        <v-list-item-subtitle>durée : {{ duration(run.startedAt, run.finishedAt) }}</v-list-item-subtitle>
      </v-list-item-content>
    </template>

    <template v-if="!run.finishedAt && run.status !== 'kill' && canExec">
      <v-list-item-action>
        <v-btn fab color="warning" x-small title="interrompre" @click.prevent="kill">
          <v-icon>mdi-stop</v-icon>
        </v-btn>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'
import { useDateFormat, useRelativeTime } from '~/composables' // probably doesn't exist

const props = defineProps({
  run: Object,
  link: Boolean,
  canExec: Boolean
})

const kill = async () => {
  try {
    await axios.post(`api/v1/runs/${props.run._id}/_kill`)
    props.run.status = 'kill'
  } catch (error) {
    console.error('Failed to kill the run:', error)
  }
}

const { date } = useDateFormat()
const { fromNow, duration } = useRelativeTime()
</script>

<style scoped>
</style>
