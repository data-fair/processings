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
        <run-list-item
          :run="run"
          :can-exec="canExec"
        />
        <run-logs-list
          v-if="steps.length === 1 && !steps[0].msg"
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

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useStore } from '../store/index.js'
import { useRoute } from 'vue-router'
import eventBus from '~/event-bus'
import RunListItem from '@/components/RunListItem.vue'
import RunLogsList from '@/components/RunLogsList.vue'

const store = useStore()
const route = useRoute()

const run = ref(null)
const runBackLink = computed(() => store.runBackLink)
const user = computed(() => store.user)

const canExec = computed(() => {
  if (!run.value) return false
  return ['admin', 'exec'].includes(run.value.userProfile)
})

const steps = computed(() => {
  if (!run.value || !run.value.log) return []
  const steps = []
  let lastStep
  for (const log of run.value.log) {
    if (log.type === 'debug' && !user.value.adminMode) continue
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
})

onMounted(async () => {
  await refresh()
  eventBus.$on('run-patch', onRunPatch)
  eventBus.$on('run-log', onRunLog)
})

onUnmounted(() => {
  eventBus.$off('run-patch', onRunPatch)
  eventBus.$off('run-log', onRunLog)
})

async function refresh() {
  try {
    const response = await fetch(`api/v1/runs/${route.params.id}`)
    run.value = await response.json()
    store.setBreadcrumbs([
      { text: 'traitements', to: '/processings' },
      { text: run.value.processing.title, to: `/processings/${run.value.processing._id}` },
      { text: 'exécution' }
    ])
  } catch (error) {
    console.error('Failed to fetch run details:', error)
  }
}

function onRunPatch(runPatch) {
  if (!run.value || run.value._id !== runPatch._id) return;
  run.value = { ...run.value, ...runPatch.patch };
}

function onRunLog(runLog) {
  if (!run.value || run.value._id !== runLog._id) return;
  if (runLog.log.type === 'task') {
    const matchingTaskIndex = run.value.log.findIndex(l => l.type === 'task' && l.msg === runLog.log.msg);
    if (matchingTaskIndex !== -1) {
      run.value.log[matchingTaskIndex] = { ...run.value.log[matchingTaskIndex], ...runLog.log };
    } else {
      run.value.log.push(runLog.log);
    }
  } else {
    run.value.log.push(runLog.log);
  }
  run.value.log = [...run.value.log];
}
</script>
