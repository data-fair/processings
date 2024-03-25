<template>
  <v-card
    rounded="lg"
    :loading="loading ? 'primary' : false"
  >
    <v-card-title>
      Exécutions
    </v-card-title>
    <v-list class="py-0">
      <template v-if="runs">
        <template
          v-for="run in runs.results"
          :key="run._id"
        >
          <v-divider />
          <run-list-item
            :run="run"
            :link="true"
            :can-exec="canExec"
          />
        </template>
      </template>
    </v-list>
  </v-card>
</template>

<script setup>
import RunListItem from '~/components/run/run-list-item.vue'
import useEventBus from '~/composables/event-bus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  canExec: Boolean,
  processing: {
    type: Object,
    default: null
  }
})

const eventBus = useEventBus()

const loading = ref(false)
const runs = ref(null)

const wsChannel = computed(() => `processings/${props.processing._id}/run-patch`)

function onRunPatch(runPatch) {
  console.log('message from', wsChannel.value, runPatch)
  if (!runs.value) return
  const matchingRun = runs.value.results.find(run => run._id === runPatch._id)
  if (!matchingRun) {
    console.log('received info from WS about an unknown run, refresh list')
    return refresh()
  }
  for (const key of Object.keys(runPatch.patch)) {
    matchingRun[key] = runPatch.patch[key]
  }
}

async function refresh() {
  loading.value = true
  runs.value = await $fetch('/api/v1/runs', {
    params: {
      processing: props.processing._id,
      size: 1000,
      sort: 'createdAt:-1',
      owner: `${props.processing.owner.type}:${props.processing.owner.id}`
    }
  })
  loading.value = false
}

onMounted(async () => {
  eventBus.emit('subscribe', wsChannel.value)
  eventBus.on(wsChannel.value, onRunPatch)
  await refresh()
})

onUnmounted(() => {
  eventBus.emit('unsubscribe', wsChannel.value)
  eventBus.off(wsChannel.value, onRunPatch)
})

watch(props.processing, refresh, { deep: true })

defineExpose({ refresh })
</script>

<style>
</style>
