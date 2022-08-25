<template>
  <v-list-item :to="link ? `/runs/${run._id}` : ''">
    <template v-if="run.status === 'running'">
      <v-list-item-avatar>
        <v-progress-circular
          indeterminate
          color="primary"
          size="24"
        />
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>démarrée {{ run.startedAt | fromNow }}</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'finished'">
      <v-list-item-avatar>
        <v-icon color="success">
          mdi-check-circle
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>terminée - {{ run.finishedAt | date }}</v-list-item-title>
        <v-list-item-subtitle>durée : {{ [run.startedAt, run.finishedAt] | from }}</v-list-item-subtitle>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'error'">
      <v-list-item-avatar>
        <v-icon color="error">
          mdi-alert
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>en échec - {{ run.finishedAt | date }}</v-list-item-title>
        <v-list-item-subtitle>durée : {{ [run.startedAt, run.finishedAt] | from }}</v-list-item-subtitle>
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
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'kill'">
      <v-list-item-avatar>
        <v-icon color="warning">
          mdi-stop
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>interruption demandée</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'killed'">
      <v-list-item-avatar>
        <v-icon color="warning">
          mdi-stop
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>interrompue manuellement - {{ run.finishedAt | date }}</v-list-item-title>
        <v-list-item-subtitle>durée : {{ [run.startedAt, run.finishedAt] | from }}</v-list-item-subtitle>
      </v-list-item-content>
    </template>

    <template v-if="!run.finishedAt && run.status !== 'kill'">
      <v-list-item-action>
        <v-btn
          fab
          color="warning"
          x-small
          title="interrompre"
          @click="kill"
        >
          <v-icon>mdi-stop</v-icon>
        </v-btn>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<script>
export default {
  props: ['run', 'link'],
  methods: {
    async kill (e) {
      e.preventDefault()
      await this.$axios.$post(`api/v1/runs/${this.run._id}/_kill`)
      // eslint-disable-next-line vue/no-mutating-props
      this.run.status = 'kill'
    }
  }
}
</script>

<style lang="css" scoped>
</style>
