<template>
  <div
    v-for="log in logs as LogEntry[]"
    :key="log.date"
    class="d-flex text-break"
  >
    <span
      v-if="log.type === 'error'"
      class="text-error"
    >
      <template v-if="log.msg.status">
        <template v-if="typeof log.msg.data === 'string'">{{ log.msg.data }}</template>
        <template v-else>{{ log.msg.statusText || 'Erreur HTTP' }} - {{ log.msg.status }}</template>
      </template>
      <template v-else>
        {{ log.msg }}
      </template>
    </span>
    <span
      v-else-if="['warning', 'info', 'debug'].includes(log.type)"
      :class="log.type === 'warning' ? 'text-info' : ''"
    >
      {{ log.msg }}
    </span>
    <span
      v-else-if="log.type === 'task'"
      :class="`${taskColor(log)}--text`"
    >
      {{ log.msg }}
      <span v-if="log.progress && !log.total">({{ log.progress.toLocaleString() }})</span>
      <span v-if="log.total">({{ (log.progress || 0).toLocaleString() }} / {{ log.total.toLocaleString() }})</span>
      <v-progress-linear
        rounded
        :color="taskColor(log)"
        :indeterminate="!log.progress || !log.total"
        :model-value="log.total ? ((log.progress || 0) / log.total) * 100 : 0"
      />
    </span>
    <v-spacer />
    <span class="pl-2 text-no-wrap text-body-small">
      {{ formatDate(log.date) }}
      <span v-if="log.progressDate">- {{ formatDate(log.progressDate) }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
const { dayjs } = useLocaleDayjs()

type LogEntry = {
  date: string
  type: string
  msg: Record<string, any>
  progress: number
  total: number
  progressDate: string
}

defineProps({
  logs: { type: Array, required: true }
})

const taskColor = (log: LogEntry) => {
  if (log.progress && log.progress === log.total) return 'success'
  return 'primary'
}

const formatDate = (date: string) => dayjs(date).format('lll')
</script>

<style scoped>
</style>
