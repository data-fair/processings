<template>
  <v-list-item :to="link ? `/runs/${run._id}` : ''">
    <template v-if="run.status === 'running'">
      <v-progress-circular
        indeterminate
        color="primary"
        size="24"
      />
      démarrée {{ run.startedAt | fromNow }}
    </template>

    <template v-if="run.status === 'finished'">
      <v-icon color="success">
        mdi-check-circle
      </v-icon>
      terminée - {{ run.finishedAt | date }}<br>
      durée : {{ duration(run.startedAt, run.finishedAt) }}
    </template>

    <template v-if="run.status === 'error'">
      <v-icon color="error">
        mdi-alert
      </v-icon>
      en échec - {{ run.finishedAt | date }}<br>
      durée : {{ duration(run.startedAt, run.finishedAt) }}
    </template>

    <template v-if="run.status === 'scheduled'">
      <v-icon>mdi-clock</v-icon>
      planifiée - {{ run.scheduledAt | date }}
    </template>

    <template v-if="run.status === 'triggered'">
      <v-icon>mdi-play-circle</v-icon>
      déclenchée manuellement {{ run.createdAt | fromNow }}<br>
      planifiée {{ run.scheduledAt | fromNow(true) }}
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
      interrompue manuellement - {{ run.finishedAt | date }}<br>
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
const props = defineProps({
  run: Object,
  link: Boolean,
  canExec: Boolean
})

const kill = async () => {
  try {
    await $fetch(`api/v1/runs/${props.run._id}/_kill`, {
      method: 'POST'
    })
    props.run.status = 'kill'
  } catch (error) {
    console.error('Failed to kill the run:', error)
  }
}
</script>

<style scoped>
</style>
