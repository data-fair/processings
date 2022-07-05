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
      <span :class="'text-body-2 ' + {error: 'error--text', warning: 'warning--text', info: ''}[log.type]">
        <template v-if="log.type === 'error' && log.msg.status">
          <template v-if="typeof log.msg.data === 'string'">{{ log.msg.data }}</template>
          <template v-else>{{ log.msg.statusText || 'Erreur HTTP' }} - {{ log.msg.status }}</template>
        </template>
        <template v-else>{{ log.msg }}</template>
      </span>
      <v-spacer />
      <span
        class="text-caption pl-2"
        style="white-space: nowrap;"
      >{{ log.date | date('lll') }}</span>
    </v-list-item>
  </v-list>
</template>

<script>
export default {
  props: {
    logs: { type: Array, required: true }
  }
}
</script>

<style>

</style>
