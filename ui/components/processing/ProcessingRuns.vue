<template>
  <v-card
    :rounded="false"
    :loading="loading ? 'primary' : false"
  >
    <v-card-title>
      Exécutions
    </v-card-title>
    <template v-if="runs">
      <v-list class="py-0">
        <template
          v-for="run in runs.results"
          :key="run._id"
        >
          <v-divider />
          <RunListItem
            :run="run"
            :link="true"
            :can-exec="canExec"
          />
        </template>
      </v-list>
      <v-pagination
        v-if="runs.count > size"
        v-model="page"
        :length="Math.ceil(runs.count / size)"
        :total-visible="5"
      />
    </template>
  </v-card>
</template>

<script setup>
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
const /** @type {Ref<Record<string, any>|null>} */ runs = ref(null)

const wsChannel = computed(() => `processings/${props.processing._id}/run-patch`)

/**
 * @param {Record<string, any>} runPatch
 */
function onRunPatch(runPatch) {
  console.log('message from', wsChannel.value, runPatch)
  if (!runs.value) return
  const matchingRun = runs.value.results.find(/** @param {Record<string, any>} run */ run => run._id === runPatch._id)
  if (!matchingRun) {
    console.log('received info from WS about an unknown run, refresh list')
    return refresh()
  }
  for (const key of Object.keys(runPatch.patch)) {
    matchingRun[key] = runPatch.patch[key]
  }
}

const size = 10
const page = ref(1)
watch(page, () => refresh(false))

// todo: use useFetch ?
async function refresh(reinit = true) {
  if (reinit && page.value !== 1) {
    page.value = 1
    return
  }
  loading.value = true
  runs.value = await $fetch('/api/v1/runs', {
    params: {
      processing: props.processing._id,
      size,
      page: page.value,
      sort: 'createdAt:-1',
      owner: `${props.processing.owner.type}:${props.processing.owner.id}${props.processing.owner.department ? ':' + props.processing.owner.department : ''}`
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
