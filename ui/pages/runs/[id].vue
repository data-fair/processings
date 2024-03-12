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
          variant="accordion"
          multiple
          :model-value="[steps.length - 1]"
        >
          <v-expansion-panel
            v-for="(step, i) in steps"
            :key="step.date"
          >
            <v-expansion-panel-title>
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
            </v-expansion-panel-title>
            <v-expansion-panel-text v-if="step.children.length">
              <run-logs-list :logs="step.children" />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import RunListItem from '~/components/run/run-list-item.vue'
import RunLogsList from '~/components/run/run-logs-list.vue'
import useEventBus from '~/composables/event-bus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@data-fair/lib/vue/session.js'

const eventBus = useEventBus()
const route = useRoute()
const session = useSession()

const loading = ref(false)
const run = ref(null)

const user = computed(() => session.state.user)

const canExec = computed(() => {
  if (!run.value) return false
  return ['admin', 'exec'].includes(run.value.userProfile)
})

const wsLogChannel = computed(() => {
  return run.value && `processings/${run.value.processing._id}/run-log`
})

const wsPatchChannel = computed(() => {
  return run.value && `processings/${run.value.processing._id}/run-patch`
})

const steps = computed(() => {
  if (!run.value) return
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
})

onUnmounted(() => {
  eventBus.emit('unsubscribe', wsLogChannel.value)
  eventBus.emit('unsubscribe', wsPatchChannel.value)
  eventBus.off(wsLogChannel.value, onRunLog)
  eventBus.off(wsPatchChannel.value, onRunPatch)
})

async function refresh() {
  loading.value = true
  run.value = await $fetch(`/api/v1/runs/${route.params.id}`)

  eventBus.emit('subscribe', wsLogChannel.value)
  eventBus.on(wsLogChannel.value, onRunLog)
  eventBus.emit('subscribe', wsPatchChannel.value)
  eventBus.on(wsPatchChannel.value, onRunPatch)

  loading.value = false
}

function onRunPatch(runPatch) {
  if (!run.value || run.value._id !== runPatch._id) return
  for (const key of Object.keys(runPatch.patch)) {
    run.value[key] = runPatch.patch[key]
  }
}

function onRunLog(runLog) {
  if (!run.value || run.value._id !== runLog._id) return
  if (runLog.log.type === 'task') {
    const matchingTaskIndex = run.value.log.findIndex(l => l.type === 'task' && l.msg === runLog.log.msg)
    if (matchingTaskIndex !== -1) {
      for (const key of Object.keys(runLog.log)) {
        run.value.log[matchingTaskIndex][key] = runLog.log[key]
      }
      return
    }
  }
  run.value.log.push(runLog.log)
}
</script>
