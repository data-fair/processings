<template>
  <v-container
    v-if="run"
    data-iframe-height
  >
    <v-row class="ma-0">
      <h2 class="text-h6">
        Exécution du traitement {{ run.processing.title }}
      </h2>
    </v-row>
    <v-row>
      <v-col>
        <run-list-item
          class="mb-4"
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
              <v-progress-circular
                v-if="i === steps.length-1 && run.status === 'running'"
                indeterminate
                color="primary"
                size="24"
              />
              <v-icon
                v-else-if="step.children.length"
                :color="getColor(step)"
                :icon="getIcon(step)"
              />
              <span style="padding-left: 1rem;">
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

<script setup lang="ts">
import type { Run } from '#api/types'

const route = useRoute()
const session = useSession()
const ws = useWS('/processings/api/')

const loading = ref(false)
const run: Ref<Run | null> = ref(null)

const user = computed(() => session.state.user)

const canExec = computed(() => {
  if (!run.value) return false
  return ['admin', 'exec'].includes(run.value.userProfile as string)
})

const runId = (route.params as { id: string }).id

const steps = computed(() => {
  if (!run.value) return []
  const steps = []
  let lastStep: Record<string, any> | null = null
  for (const log of run.value.log) {
    if (log.type === 'debug' && !user.value?.adminMode) continue
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

function getColor (step: Record<string, any>) {
  let color = 'success'

  for (const child of step.children) {
    if (child.type === 'error') {
      color = 'error'
      break
    }
    if (child.type === 'warning') {
      color = 'accent'
    }
  }

  return color
}

function getIcon (step: Record<string, any>) {
  let icon = mdiCheckCircle

  for (const child of step.children) {
    if (child.type === 'error') {
      icon = mdiAlert
      break
    }
    if (child.type === 'warning') {
      icon = mdiAlertCircle
    }
  }

  return icon
}

onMounted(async () => {
  loading.value = true
  run.value = await $fetch(`${$apiPath}/runs/${runId}`)
  if (!run.value) return

  ws?.subscribe(`processings/${run.value.processing._id}/run-log`, onRunLog)
  ws?.subscribe(`processings/${run.value.processing._id}/run-patch`, onRunPatch)

  setBreadcrumbs([{
    text: 'traitements',
    to: '/processings'
  }, {
    text: run.value.processing.title,
    to: `/processings/${run.value.processing._id}`
  }, {
    text: 'exécution'
  }])
  loading.value = false
})

onUnmounted(() => {
  ws?.unsubscribe(`processings/${run.value?.processing._id}/run-log`, onRunLog)
  ws?.unsubscribe(`processings/${run.value?.processing._id}/run-patch`, onRunPatch)
})

function onRunPatch (runPatch: Record<string, any>) {
  if (!run.value || run.value._id !== runPatch._id) return
  for (const key of Object.keys(runPatch.patch)) {
    run.value[key] = runPatch.patch[key]
  }
}

function onRunLog (runLog: Record<string, any>) {
  if (!run.value || run.value._id !== runLog._id) return
  if (runLog.log.type === 'task') {
    const matchingTaskIndex = run.value.log.findIndex((l: any) => l.type === 'task' && l.msg === runLog.log.msg)
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
