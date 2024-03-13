<template>
  <div>
    <v-card
      v-for="log in logs"
      :key="log.date"
      class="mb-2"
      variant="text"
    >
      <v-card-text class="py-0">
        <div
          class="d-flex align-center"
          style="min-height: 26px;"
        >
          <div class="flex-grow-1">
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
              v-if="log.type === 'warning'"
              class="text-warning"
            >
              {{ log.msg }}
            </span>
            <span v-if="log.type === 'info'">
              {{ log.msg }}
            </span>
            <span v-if="log.type === 'debug'">
              {{ log.msg }}
            </span>
            <span
              v-if="log.type === 'task'"
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
          </div>
          <v-spacer />
          <div style="white-space: nowrap;">
            <span class="pl-2">
              {{ $filters.date(log.date, 'lll') }}
              <span v-if="log.progressDate">- {{ $filters.date(log.progressDate, 'lll') }}</span>
            </span>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
defineProps({
  logs: { type: Array, required: true }
})

const taskColor = (log) => {
  if (log.progress && log.progress === log.total) return 'success'
  return 'primary'
}
</script>

<style scoped>
.flex-grow-1 {
  flex-grow: 1;
}
</style>
