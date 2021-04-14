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
        <v-list-item-title>démarrée {{ run.startedAt | moment('from') }}</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'finished'">
      <v-list-item-avatar>
        <v-icon color="success">
          mdi-check-circle
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>terminée {{ run.finishedAt | moment('from') }}</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'error'">
      <v-list-item-avatar>
        <v-icon color="error">
          mdi-alert
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>en échec {{ run.finishedAt | moment('from') }}</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'scheduled'">
      <v-list-item-avatar>
        <v-icon>mdi-clock</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>planifiée {{ run.scheduledAt | moment('from') }}</v-list-item-title>
      </v-list-item-content>
    </template>

    <template v-if="run.status === 'triggered'">
      <v-list-item-avatar>
        <v-icon>mdi-play-circle</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>déclenchée manuellement {{ run.createdAt | moment('from') }}</v-list-item-title>
      </v-list-item-content>
    </template>
  </v-list-item>
</template>

<script>
  export default {
    props: ['run', 'link'],
  }
</script>

<style lang="css" scoped>
</style>
