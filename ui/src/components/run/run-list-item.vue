<template>
  <v-list-item
    class="py-4"
    :to="link ? `/runs/${run._id}` : ''"
  >
    <template #prepend>
      <v-avatar v-if="props.run.status === 'running'">
        <v-progress-circular
          indeterminate
          color="primary"
          size="24"
        />
      </v-avatar>
      <v-avatar v-if="props.run.status === 'finished'">
        <v-icon
          color="success"
          :icon="mdiCheckCircle"
        />
      </v-avatar>
      <v-avatar v-if="props.run.status === 'error'">
        <v-icon
          color="error"
          :icon="mdiAlert"
        />
      </v-avatar>
      <v-avatar v-if="props.run.status === 'scheduled'">
        <v-icon
          color="primary"
          :icon="mdiClock"
        />
      </v-avatar>
      <v-avatar v-if="props.run.status === 'triggered'">
        <v-icon
          color="primary"
          :icon="mdiPlayCircle"
        />
      </v-avatar>
      <v-avatar v-if="props.run.status === 'kill' || props.run.status === 'killed'">
        <v-icon
          color="accent"
          :icon="mdiStop"
        />
      </v-avatar>
    </template>

    <v-list-item-title v-if="props.run.status === 'running'">
      Démarrée {{ fromNow(run.startedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'finished'">
      Terminée - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'error'">
      En échec - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'scheduled'">
      Planifiée - {{ formatDate(run.scheduledAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'triggered'">
      Déclenchée manuellement {{ fromNow(run.createdAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'kill'">
      Interruption demandée
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'killed'">
      Interrompue manuellement - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>

    <v-list-item-subtitle v-if="props.run.status === 'finished' || props.run.status === 'error' || props.run.status === 'killed'">
      Durée : {{ duration(run.startedAt, run.finishedAt) }}
    </v-list-item-subtitle>
    <v-list-item-subtitle v-if="props.run.status === 'triggered' && run.scheduledAt && run.scheduledAt !== run.createdAt">
      Planifiée {{ fromNow(run.scheduledAt) }}
    </v-list-item-subtitle>

    <template
      v-if="!run.finishedAt && props.run.status !== 'kill' && canExec"
      #append
    >
      <v-btn
        color="warning"
        :icon="mdiStop"
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
  await $fetch(`/runs/${props.run._id}/_kill`, {
    method: 'POST'
  })
}
</script>

<style></style>
