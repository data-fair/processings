<template>
  <v-list
    dense
    class="py-0"
  >
    <v-list-item
      v-for="log in logs"
      :key="log.date"
      style="min-height: 26px;"
    >
      <span
        v-if="log.type === 'error'"
        class="text-body-2 error--text"
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
        class="text-body-2 warning--text"
      >
        {{ log.msg }}
      </span>
      <span
        v-if="log.type === 'info'"
        class="text-body-2"
      >
        {{ log.msg }}
      </span>
      <span
        v-if="log.type === 'debug'"
        class="text-caption"
      >
        {{ log.msg }}
      </span>
      <span
        v-if="log.type === 'task'"
        class="text-body-2"
        :class="`${taskColor(log)}--text`"
      >
        {{ log.msg }}
        <span v-if="log.progress && !log.total">({{ log.progress.toLocaleString() }})</span>
        <span v-if="log.total">({{ (log.progress || 0).toLocaleString() }} / {{ log.total.toLocaleString() }})</span>
        <v-progress-linear
          rounded
          :color="taskColor(log)"
          :indeterminate="!log.progress || !log.total"
          :query="true"
          :value="log.total ? ((log.progress || 0) / log.total) * 100 : 0"
        />

      </span>
      <v-spacer />
      <span
        class="text-caption pl-2"
        style="white-space: nowrap;"
      >{{ log.date | date('lll') }}</span>
      <span
        v-if="log.progressDate"
        class="text-caption pl-2"
        style="white-space: nowrap;"
      >- {{ log.progressDate | date('lll') }}</span>
    </v-list-item>
  </v-list>
</template>

<script>
export default {
  props: {
    logs: { type: Array, required: true }
  },
  methods: {
    taskColor (log) {
      if (log.progress && log.progress === log.total) return 'success'
      return 'primary'
    }
  }
}
</script>

<style>

</style>
