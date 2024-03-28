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
              class="text-accent"
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
              {{ format.date(log.date, 'lll') }}
              <span v-if="log.progressDate">- {{ format.date(log.progressDate, 'lll') }}</span>
            </span>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import useDateFormat from '~/composables/date-format'
const format = useDateFormat()

/**
 * Defines a log entry in the logs array.
 * @typedef {Object} LogEntry
 * @property {string} date - The date of the log.
 * @property {string} type - The type of the log.
 * @property {Record<String, any>} msg - The message of the log.
 * @property {number} progress - The progress of the log.
 * @property {number} total - The total of the log.
 * @property {string} progressDate - The progress date of the log.
 */

/**
 * @type {{logs: LogEntry[]}}
 */
defineProps({
  logs: { type: Array, required: true }
})

const taskColor = (/** @type {Record<String, any>} */ log) => {
  if (log.progress && log.progress === log.total) return 'success'
  return 'primary'
}
</script>

<style scoped>
.flex-grow-1 {
  flex-grow: 1;
}
</style>
