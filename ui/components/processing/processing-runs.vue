<template>
  <v-card
    rounded="0"
    :loading="loading"
  >
    <v-card-title>
      Exécutions
    </v-card-title>
    <v-list class="py-0">
      <template v-if="runs">
        <template v-for="run in runs.results">
          <v-divider :key="`${run._id}-divider`" />
          <run-list-item
            :key="`${run._id}-item`"
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useEventBus } from '~/composables/event-bus'

const props = defineProps({
  processing: Object,
  canExec: Boolean
})

const loading = ref(false)
const runs = ref(null)

const eventBus = useEventBus()
const wsChannel = `processings/${props.processing._id}/run-patch`

function onRunPatch(runPatch) {
  console.log('message from', wsChannel, runPatch)
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
  try {
    const response = await $fetch('api/v1/runs', {
      body: {
        params: { 
          processing: props.processing._id, 
          size: 1000, 
          sort: 'createdAt:-1', 
          owner: `${props.processing.owner.type}:${props.processing.owner.id}` 
        } 
      }
    })
    runs.value = response
  } catch (error) {
    console.error('Failed to refresh runs:', error)
  }
  loading.value = false
}

onMounted(async () => {
  eventBus.subscribe(wsChannel, onRunPatch)
  await refresh()
})

onUnmounted(() => {
  eventBus.unsubscribe(wsChannel)
})

watch(props.processing, refresh, { deep: true })
</script>

<style scoped>
</style>
