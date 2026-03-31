<template>
  <v-list-item
    class="py-4"
    :to="link ? `/processings/${run.processing._id}/runs/${run._id}` : ''"
  >
    <template #prepend>
      <v-progress-circular
        v-if="props.run.status === 'running'"
        indeterminate
        color="primary"
        size="24"
      />
      <v-icon
        v-if="props.run.status === 'finished'"
        color="success"
        :icon="mdiCheckCircle"
      />
      <v-icon
        v-if="props.run.status === 'error'"
        color="error"
        :icon="mdiAlert"
      />
      <v-icon
        v-if="props.run.status === 'scheduled'"
        color="primary"
        :icon="mdiClock"
      />
      <v-icon
        v-if="props.run.status === 'triggered'"
        color="primary"
        :icon="mdiPlayCircle"
      />
      <v-icon
        v-if="props.run.status === 'kill' || props.run.status === 'killed'"
        color="accent"
        :icon="mdiStop"
      />
    </template>

    <v-list-item-title v-if="props.run.status === 'running'">
      {{ t('started') }} {{ fromNow(run.startedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'finished'">
      {{ t('finished') }} {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'error'">
      {{ t('error') }} {{ formatDate(run.finishedAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'scheduled'">
      {{ t('scheduled') }} {{ formatDate(run.scheduledAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'triggered'">
      {{ t('triggered') }} {{ fromNow(run.createdAt) }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'kill'">
      {{ t('killRequested') }}
    </v-list-item-title>
    <v-list-item-title v-if="props.run.status === 'killed'">
      {{ t('killed') }} {{ formatDate(run.finishedAt) }}
    </v-list-item-title>

    <v-list-item-subtitle v-if="props.run.status === 'finished' || props.run.status === 'error' || props.run.status === 'killed'">
      {{ t('duration') }} {{ duration(run.startedAt, run.finishedAt) }}
    </v-list-item-subtitle>
    <v-list-item-subtitle v-if="props.run.status === 'triggered' && run.scheduledAt && run.scheduledAt !== run.createdAt">
      {{ t('scheduledAt') }} {{ fromNow(run.scheduledAt) }}
    </v-list-item-subtitle>

    <template
      v-if="!run.finishedAt && props.run.status !== 'kill' && canExec"
      #append
    >
      <v-btn
        color="warning"
        :icon="mdiStop"
        size="x-small"
        :title="t('kill')"
        @click.prevent="kill()"
      />
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
const { t } = useI18n()
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

<i18n lang="yaml">
  en:
    started: Started
    finished: Finished -
    error: Failed -
    scheduled: Scheduled -
    triggered: Manually triggered
    killRequested: Kill requested
    killed: Manually killed -
    duration: "Duration:"
    scheduledAt: Scheduled
    kill: kill

  fr:
    started: Démarrée
    finished: Terminée -
    error: En échec -
    scheduled: Planifiée -
    triggered: Déclenchée manuellement
    killRequested: Interruption demandée
    killed: Interrompue manuellement -
    duration: "Durée :"
    scheduledAt: Planifiée
    kill: interrompre

</i18n>

<style scoped>
</style>
