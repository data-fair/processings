<template>
  <v-list-item :to="link ? `/runs/${run._id}` : ''">
    <template v-if="run.status === 'running'">
      <v-progress-circular
        indeterminate
        color="primary"
        size="24"
      />
      démarrée {{ $filters.fromNow(run.startedAt) }}
    </template>

    <template v-if="run.status === 'finished'">
      <v-icon color="success">
        mdi-check-circle
      </v-icon>
      terminée - {{ $filters.date(run.finishedAt) }}<br>
      durée : {{ duration(run.startedAt, run.finishedAt) }}
    </template>

    <template v-if="run.status === 'error'">
      <v-icon color="error">
        mdi-alert
      </v-icon>
      en échec - {{ $filters.date(run.finishedAt) }}<br>
      durée : {{ duration(run.startedAt, run.finishedAt) }}
    </template>

    <template v-if="run.status === 'scheduled'">
      <v-icon>mdi-clock</v-icon>
      planifiée - {{ $filters.date(run.scheduledAt) }}
    </template>

    <template v-if="run.status === 'triggered'">
      <v-icon>mdi-play-circle</v-icon>
      déclenchée manuellement {{ $filters.fromNow(run.createdAt) }}<br>
      planifiée {{ $filters.fromNow(run.scheduledAt, true) }}
    </template>

    <template v-if="run.status === 'kill'">
      <v-icon color="warning">
        mdi-stop
      </v-icon>
      interruption demandée
    </template>

    <template v-if="run.status === 'killed'">
      <v-icon color="warning">
        mdi-stop
      </v-icon>
      interrompue manuellement - {{ $filters.date(run.finishedAt) }}<br>
      durée : {{ duration(run.startedAt, run.finishedAt) }}
    </template>

    <template v-if="!run.finishedAt && run.status !== 'kill' && canExec">
      <v-list-item-action>
        <v-btn
          class=".rounded-circle"
          color="warning"
          size="x-small"
          title="interrompre"
          @click.prevent="kill"
        >
          <v-icon>mdi-stop</v-icon>
        </v-btn>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '~/store/index'

const nuxtApp = useNuxtApp()
const duration = nuxtApp.$dayjs.duration

const store = useStore()
const env = computed(() => store.env)

const emit = defineEmits(['update:run'])
const props = defineProps({
  canExec: Boolean,
  link: Boolean,
  run: Object
})

const kill = async (e) => {
  e.preventDefault()
  await $fetch(`${env.value.publicUrl}/api/v1/runs/${props.run._id}/_kill`, {
    method: 'POST'
  })
  emit('update:run', { ...props.run, status: 'kill' })
}
</script>

<style>
</style>
