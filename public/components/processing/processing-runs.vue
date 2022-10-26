<template>
  <v-card
    tile
    :loading="loading"
  >
    <v-card-title>
      Exécutions
      <v-spacer />
      <v-btn
        icon
        @click="refresh"
      >
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </v-card-title>
    <v-list class="py-0">
      <template v-if="runs">
        <template v-for="run in runs.results">
          <v-divider :key="run._id + '-divider'" />
          <run-list-item
            :key="run._id + '-item'"
            :run="run"
            :link="true"
          />
        </template>
      </template>
    </v-list>
  </v-card>
</template>

<script>
import eventBus from '~/event-bus'

export default {
  props: ['processing'],
  data () {
    return { loading: false, runs: null }
  },
  computed: {
    wsChannel () {
      return `processings/${this.processing._id}/run-patch`
    }
  },
  async mounted () {
    eventBus.$emit('subscribe', this.wsChannel)
    eventBus.$on(this.wsChannel, this.onRunPatch)
    await this.refresh()
  },
  destroyed () {
    eventBus.$emit('unsubscribe', this.wsChannel)
    eventBus.$off(this.onRunPatch)
  },
  methods: {
    onRunPatch (runPatch) {
      console.log('message from', this.wsChannel, runPatch)
      if (!this.runs) return
      const matchingRun = this.runs.results.find(run => run._id === runPatch._id)
      if (!matchingRun) {
        console.log('received info from WS about an unknown run, refresh list')
        return this.refresh()
      }
      for (const key of Object.keys(runPatch.patch)) {
        this.$set(matchingRun, key, runPatch.patch[key])
      }
    },
    async refresh () {
      this.loading = true
      this.runs = await this.$axios.$get('api/v1/runs', { params: { processing: this.processing._id, size: 1000, sort: 'createdAt:-1' } })
      this.loading = false
    }
  }
}
</script>

<style lang="css" scoped>
</style>
