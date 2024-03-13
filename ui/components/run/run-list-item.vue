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
          icon="mdi-check-circle"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'error'">
        <v-icon
          color="error"
          icon="mdi-alert"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'scheduled'">
        <v-icon
          color="primary"
          icon="mdi-clock"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'triggered'">
        <v-icon
          color="primary"
          icon="mdi-play-circle"
        />
      </v-avatar>
      <v-avatar v-if="run.status === 'kill' || run.status === 'killed'">
        <v-icon
          color="warning"
          icon="mdi-stop"
        />
      </v-avatar>
    </template>

    <v-list-item-title v-if="run.status === 'running'">
      démarrée {{ $filters.fromNow(run.startedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'finished'">
      terminée - {{ $filters.date(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'error'">
      en échec - {{ $filters.date(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'scheduled'">
      planifiée - {{ $filters.date(run.scheduledAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'triggered'">
      déclenchée manuellement {{ $filters.fromNow(run.createdAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'kill'">
      interruption demandée
    </v-list-item-title>
    <v-list-item-title v-if="run.status === 'killed'">
      interrompue manuellement - {{ $filters.date(run.finishedAt) }}
    </v-list-item-title>

    <v-list-item-subtitle v-if="run.status === 'finished' || run.status === 'error' || run.status === 'killed'">
      durée : {{ duration(run.startedAt, run.finishedAt) }}
    </v-list-item-subtitle>
    <v-list-item-subtitle v-if="run.status === 'triggered' && run.scheduledAt && run.scheduledAt !== run.createdAt">
      planifiée {{ $filters.fromNow(run.scheduledAt, true) }}
    </v-list-item-subtitle>

    <template
      v-if="!run.finishedAt && run.status !== 'kill' && canExec"
      #append
    >
      <v-btn
        color="warning"
        icon="mdi-stop"
        size="x-small"
        title="interrompre"
        @click.prevent="kill()"
      />
    </template>
  </v-list-item>
</template>

<script setup>
const nuxtApp = useNuxtApp()
const dayjs = nuxtApp.$dayjs

const emit = defineEmits(['update:run'])
const props = defineProps({
  canExec: Boolean,
  link: Boolean,
  run: {
    type: Object,
    default: null
  }
})

function duration(start, end) {
  return dayjs.duration(dayjs(end).diff(dayjs(start))).humanize()
}

const kill = async (e) => {
  e.preventDefault()
  await $fetch(`/api/v1/runs/${props.run._id}/_kill`, {
    method: 'POST'
  })
  emit('update:run', { ...props.run, status: 'kill' })
}
</script>

<style>
</style>
