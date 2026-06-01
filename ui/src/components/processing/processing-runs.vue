<template>
  <v-card
    :rounded="false"
    :loading="runs.loading.value ? 'primary' : false"
    :title="t('runs')"
  >
    <template v-if="runs">
      <v-list class="py-0">
        <template
          v-for="run in displayRuns"
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
        v-if="(runs.data.value?.count ?? 0) > size"
        v-model="page"
        :length="Math.ceil((runs.data.value?.count ?? 0) / size)"
        @update:model-value="runs.refresh()"
      />
    </template>
  </v-card>
</template>

<script setup lang="ts">
import type { Run } from '#api/types'

const { t } = useI18n()

const props = defineProps({
  canExec: Boolean,
  processing: {
    type: Object,
    default: null
  }
})

const ws = useWS('/processings/api/')
const wsChannel = computed(() => `processings/${props.processing._id}/run-patch`)

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
  })),
  watch: false
})

const displayRuns = ref<Run[]>([])
watch(() => runs.data.value?.results, (results) => {
  displayRuns.value = results ?? []
}, { immediate: true })

function onRunPatch (runPatch: { _id: string, patch: Record<string, any> }) {
  const matchingRun = displayRuns.value.find(run => run._id === runPatch._id)
  if (!matchingRun) return runs.refresh()
  Object.assign(matchingRun, runPatch.patch)
}

onMounted(async () => {
  ws?.subscribe(wsChannel.value, onRunPatch)
  await runs.refresh()
})

onUnmounted(() => {
  ws?.unsubscribe(wsChannel.value, onRunPatch)
})

defineExpose({ refresh: () => runs.refresh() })
</script>

<i18n lang="yaml">
  en:
    runs: Runs

  fr:
    runs: Exécutions

</i18n>
