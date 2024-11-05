<template>
  <v-list-item
    class="py-4"
    :to="link ? `/runs/${run._id}` : ''"
  >
    <template #prepend>
      <v-avatar v-if="runStatus === 'running'">
        <v-progress-circular
          indeterminate
          color="primary"
          size="24"
        />
      </v-avatar>
      <v-avatar v-if="runStatus === 'finished'">
        <v-icon
          color="success"
          :icon="mdiCheckCircle"
        />
      </v-avatar>
      <v-avatar v-if="runStatus === 'error'">
        <v-icon
          color="error"
          :icon="mdiAlert"
        />
      </v-avatar>
      <v-avatar v-if="runStatus === 'scheduled'">
        <v-icon
          color="primary"
          :icon="mdiClock"
        />
      </v-avatar>
      <v-avatar v-if="runStatus === 'triggered'">
        <v-icon
          color="primary"
          :icon="mdiPlayCircle"
        />
      </v-avatar>
      <v-avatar v-if="runStatus === 'kill' || runStatus === 'killed'">
        <v-icon
          color="accent"
          :icon="mdiStop"
        />
      </v-avatar>
    </template>

    <v-list-item-title v-if="runStatus === 'running'">
      Démarrée {{ fromNow(run.startedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="runStatus === 'finished'">
      Terminée - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="runStatus === 'error'">
      En échec - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="runStatus === 'scheduled'">
      Planifiée - {{ formatDate(run.scheduledAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="runStatus === 'triggered'">
      Déclenchée manuellement {{ fromNow(run.createdAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="runStatus === 'kill'">
      Interruption demandée
    </v-list-item-title>
    <v-list-item-title v-if="runStatus === 'killed'">
      Interrompue manuellement - {{ formatDate(run.finishedAt) }}
    </v-list-item-title>

    <v-list-item-subtitle v-if="runStatus === 'finished' || runStatus === 'error' || runStatus === 'killed'">
      Durée : {{ duration(run.startedAt, run.finishedAt) }}
    </v-list-item-subtitle>
    <v-list-item-subtitle v-if="runStatus === 'triggered' && run.scheduledAt && run.scheduledAt !== run.createdAt">
      Planifiée {{ fromNow(run.scheduledAt) }}
    </v-list-item-subtitle>

    <template
      v-if="!run.finishedAt && runStatus !== 'kill' && canExec"
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

const runStatus = ref(props.run.status)

const fromNow = (date: string) => dayjs(date).fromNow()
const formatDate = (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
const duration = (start: string, end: string) => dayjs(end).from(dayjs(start), true)

const kill = async () => {
  await $fetch(`${$apiPath}/runs/${props.run._id}/_kill`, {
    method: 'POST'
  })
  runStatus.value = 'kill'
}
</script>

<style></style>
