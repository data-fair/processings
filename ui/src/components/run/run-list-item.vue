<template>
  <v-list-item
    class="py-4"
    :to="link ? `/runs/${run._id}` : ''"
  >
    <template #prepend>
      <v-avatar v-if="run.status === 'running'">
        <v-progress-circular
          indeterminate
          color="primary"
          size="24"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'finished'">
        <v-icon
          color="success"
          :icon="mdi-check-circle"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'error'">
        <v-icon
          color="error"
          :icon="mdi-alert"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'scheduled'">
        <v-icon
          color="primary"
          :icon="mdi-clock"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'triggered'">
        <v-icon
          color="primary"
          :icon="mdi-play-circle"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'kill' || run.status === 'killed'">
        <v-icon
          color="accent"
          :icon="mdi-stop"
        />
      </v-avatar>
    </template>

    <v-list-item-title v-if="run.status === 'running'">
      Démarrée {{ fromNow(run.startedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'finished'">
      Terminée - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'error'">
      En échec - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'scheduled'">
      Planifiée - {{ formatDate(run.scheduledAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'triggered'">
      Déclenchée manuellement {{ fromNow(run.createdAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'kill'">
      Interruption demandée
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'killed'">
      Interrompue manuellement - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>

    <v-list-item-subtitle v-if="run.status === 'finished' || run.status === 'error' || run.status === 'killed'">
      Durée : {{ duration(run.startedAt, run.finishedAt) }}
    </v-list-item-subtitle>
    <v-list-item-subtitle v-if="run.status === 'triggered' && run.scheduledAt && run.scheduledAt !== run.createdAt">
      Planifiée {{ fromNow(run.scheduledAt) }}
    </v-list-item-subtitle>

    <template
      v-if="!run.finishedAt && run.status !== 'kill' && canExec"
      #append
    >
      <v-btn
        color="warning"
        :icon="mdi-stop"
        size="x-small"
        title="interrompre"
        @click.prevent="kill()"
      />
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
const { dayjs } = useLocaleDayjs()

const props = defineProps({
  canExec: Boolean,
  link: Boolean,
  run: {
    type: Object,
    default: null
  }
})

const fromNow = (date: string) => dayjs(date).fromNow()
const formatDate = (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
const duration = (start: string, end: string) => dayjs(end).from(dayjs(start), true)

const kill = async () => {
  await $fetch(`${$apiPath}/runs/${props.run._id}/_kill`, {
    method: 'POST'
  })
  props.run.status = 'kill'
}
</script>

<style></style>
