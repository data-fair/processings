<template>
  <v-card
    :rounded="false"
    :loading="runs.loading.value ? 'primary' : false"
  >
    <v-card-title>
      Exécutions
    </v-card-title>
    <template v-if="runs">
      <v-list class="py-0">
        <template
          v-for="run in runs.data.value?.results"
          :key="run._id"
        >
          <v-divider />
          <run-list-item
            :run="run"
            :link="true"
            :can-exec="canExec"
          />
        </template>
      </v-list>
      <v-pagination
        v-if="runs.data.value?.count > size"
        v-model="page"
        :length="Math.ceil((runs.data.value?.count ?? 0) / size)"
        :total-visible="5"
      />
    </template>
  </v-card>
</template>

<script setup lang="ts">
import type { Run } from '#api/types'

const props = defineProps({
  canExec: Boolean,
  processing: {
    type: Object,
    default: null
  }
})

const ws = useWS('/processings')
const wsChannel = computed(() => `processings/${props.processing._id}/run-patch`)

function onRunPatch (runPatch: { _id: string, patch: Record<string, any> }) {
  console.log('message from', wsChannel.value, runPatch)
  if (!runs.data.value) return
  const matchingRun = runs.data.value.results.find(run => run._id === runPatch._id)
  if (!matchingRun) {
    console.log('received info from WS about an unknown run, refresh list')
    return runs.refresh()
  }
  for (const key of Object.keys(runPatch.patch)) {
    matchingRun[key] = runPatch.patch[key]
  }
}

const size = 10
const page = ref(1)

const runs = useFetch<{
  results: Run[],
  count: number
}>(`${$apiPath}/runs`, {
  query: computed(() => ({
    processing: props.processing._id,
    size,
    page: page.value,
    sort: 'createdAt:-1',
    owner: `${props.processing.owner.type}:${props.processing.owner.id}${props.processing.owner.department ? ':' + props.processing.owner.department : ''}`
  }))
})

onMounted(async () => {
  ws?.subscribe(wsChannel.value, onRunPatch)
  await runs.refresh()
})

onUnmounted(() => {
  ws?.unsubscribe(wsChannel.value, onRunPatch)
})
</script>

<style>
</style>
