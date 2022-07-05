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

        <v-expansion-panels
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
              <v-list
                dense
                class="py-0"
              >
                <v-list-item
                  v-for="log in step.children"
                  :key="log.date"
                  style="min-height: 26px;"
                >
                  <span :class="'text-body-2 ' + {error: 'error--text', warning: 'warning--text', info: ''}[log.type]">
                    <template v-if="log.type === 'error' && log.msg.status">
                      <template v-if="typeof log.msg.data === 'string'">{{ log.msg.data }}</template>
                      <template v-else>{{ log.msg.statusText || 'Erreur HTTP' }} - {{ log.msg.status }}</template>
                    </template>
                    <template v-else>{{ log.msg }}</template>
                  </span>
                  <v-spacer />
                  <span
                    class="text-caption pl-2"
                    style="white-space: nowrap;"
                  >{{ log.date | date('lll') }}</span>
                </v-list-item>
              </v-list>
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
