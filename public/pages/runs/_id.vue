<template>
  <v-container
    v-if="run"
    data-iframe-height
  >
    <v-row class="ma-0">
      <h2 class="text-h6">
        Exécution du traitement {{ run.processing.title }}
        <v-btn
          icon
          @click="refresh"
        >
          <v-icon>mdi-refresh</v-icon>
        </v-btn>
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

export default {
  middleware: 'contrib-required',
  data () {
    return { loading: false, run: null }
  },
  computed: {
    ...mapState(['runBackLink']),
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
  methods: {
    async refresh () {
      this.loading = true
      this.run = await this.$axios.$get(`api/v1/runs/${this.$route.params.id}`)
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
    }
  }
}
</script>

<style lang="css" scoped>
</style>
