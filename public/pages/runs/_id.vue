<template>
  <v-container
    v-if="run"
    data-iframe-height
  >
    <v-row class="ma-0">
      <h2 class="text-h6">
        Exécution du traitement {{ run.processing.title }}
      </h2>
      <v-spacer />
      <v-btn
        v-if="runBackLink"
        text
        :to="`/processings/${run.processing._id}`"
      >
        <v-icon style="transform: scale(-1, 1)">
          mdi-share
        </v-icon>
        revenir
      </v-btn>
    </v-row>
    <v-row>
      <v-col>
        <run-list-item :run="run" />
        <run-logs-list
          v-if="steps.length === 1 && !steps.msg"
          :logs="steps[0].children"
        />
        <v-expansion-panels
          v-else
          accordion
          multiple
          :value="[steps.length - 1]"
        >
          <v-expansion-panel
            v-for="(step, i) in steps"
            :key="step.date"
          >
            <v-expansion-panel-header>
              <span class="text-body-1">
                <v-progress-circular
                  v-if="i === steps.length-1 && run.status === 'running'"
                  indeterminate
                  color="primary"
                  size="24"
                />
                &nbsp;
                {{ step.msg }}
              </span>
            </v-expansion-panel-header>
            <v-expansion-panel-content v-if="step.children.length">
              <run-logs-list :logs="step.children" />
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'
import eventBus from '~/event-bus'

export default {
  middleware: 'contrib-required',
  data () {
    return { loading: false, run: null }
  },
  computed: {
    ...mapState(['runBackLink']),
    wsLogChannel () {
      return `processings/${this.run.processing._id}/run-log`
    },
    wsPatchChannel () {
      return `processings/${this.run.processing._id}/run-patch`
    },
    steps () {
      if (!this.run) return
      const steps = []
      let lastStep
      for (const log of this.run.log) {
        if (log.type === 'debug') continue
        if (log.type === 'step') {
          lastStep = { ...log, children: [] }
          steps.push(lastStep)
        } else {
          if (!lastStep) {
            lastStep = { date: log.date, msg: '', children: [] }
            steps.push(lastStep)
          }
          lastStep.children.push(log)
        }
      }
      return steps
    }
  },
  async mounted () {
    await this.refresh()
  },
  destroyed () {
    eventBus.$emit('unsubscribe', this.wsLogChannel)
    eventBus.$emit('unsubscribe', this.wsPatchChannel)
    eventBus.$off(this.onRunPatch)
    eventBus.$off(this.onRunLog)
  },
  methods: {
    async refresh () {
      this.loading = true
      this.run = await this.$axios.$get(`api/v1/runs/${this.$route.params.id}`)

      eventBus.$emit('subscribe', this.wsPatchChannel)
      eventBus.$on(this.wsPatchChannel, this.onRunPatch)
      eventBus.$emit('subscribe', this.wsLogChannel)
      eventBus.$on(this.wsLogChannel, this.onRunLog)

      this.$store.dispatch('setBreadcrumbs', [{
        text: 'traitements',
        to: '/processings'
      }, {
        text: this.run.processing.title,
        to: `/processings/${this.run.processing._id}`
      }, {
        text: 'exécution'
      }])
      this.loading = false
    },
    onRunPatch (runPatch) {
      if (!this.run || this.run._id !== runPatch._id) return
      for (const key of Object.keys(runPatch.patch)) {
        this.$set(this.run, key, runPatch.patch[key])
      }
    },
    onRunLog (runLog) {
      if (!this.run || this.run._id !== runLog._id) return
      if (runLog.log.type === 'task') {
        const matchingTask = this.run.log.find(l => l.type === 'task' && l.msg === runLog.log.msg)
        if (matchingTask) {
          for (const key of Object.keys(runLog.log)) {
            this.$set(matchingTask, key, runLog.log[key])
          }
          return
        }
      }
      this.run.log.push(runLog.log)
    }
  }
}
</script>

<style lang="css" scoped>
</style>
