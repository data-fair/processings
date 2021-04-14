<template>
  <v-container v-if="run">
    <v-row>
      <v-col :style="$vuetify.breakpoint.lgAndUp ? 'padding-right:256px;' : ''">
        <h2 class="text-h6">
          Exécution du traitement {{ run.processing.title }}
          <v-btn icon @click="refresh">
            <v-icon>mdi-refresh</v-icon>
          </v-btn>
        </h2>
        <run-list-item :run="run" />

        <v-expansion-panels
          accordion
          multiple
          :value="[steps.length - 1]"
        >
          <v-expansion-panel v-for="(step, i) in steps" :key="step.date">
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
              <v-list dense class="py-0">
                <v-list-item
                  v-for="log in step.children"
                  :key="log.date"
                  style="min-height: 26px;"
                >
                  <span :class="'text-body-2 ' + {error: 'error--text', warning: 'warning--text', info: ''}[log.type]">{{ log.msg }}</span>
                  <v-spacer />
                  <span class="text-caption">{{ log.date | moment('lll') }}</span>
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
  export default {
    data() {
      return { loading: false, run: null }
    },
    computed: {
      steps() {
        if (!this.run) return
        const steps = []
        let lastStep = {}
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
      },
    },
    async mounted() {
      await this.refresh()
    },
    methods: {
      async refresh() {
        this.loading = true
        this.run = await this.$axios.$get(`api/v1/runs/${this.$route.params.id}`)
        this.loading = false
      },
    },
  }
</script>

<style lang="css" scoped>
</style>
