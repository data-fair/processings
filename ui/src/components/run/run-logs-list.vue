<template>
  <div
    v-for="log in logs as LogEntry[]"
    :key="log.date"
  >
    <div class="d-flex text-break">
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
        :class="logTextClass(log)"
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
      <v-btn
        v-if="isSuperadmin && hasExtra(log)"
        class="align-self-center"
        variant="text"
        size="small"
        color="admin"
        :append-icon="expanded[log.date] ? mdiChevronUp : mdiChevronDown"
        @click="expanded[log.date] = !expanded[log.date]"
      >
        {{ t('viewExtra') }}
      </v-btn>
      <span class="pl-2 text-no-wrap text-body-small align-self-center">
        {{ formatDate(log.date) }}
        <span v-if="log.progressDate">- {{ formatDate(log.progressDate) }}</span>
      </span>
    </div>
    <v-expand-transition>
      <v-card
        v-if="isSuperadmin && hasExtra(log) && expanded[log.date]"
        color="surface-variant"
        class="overflow-auto"
        max-height="300"
      >
      <v-btn
        :prepend-icon="mdiContentCopy"
        variant="text"
        size="small"
        @click="copyExtra(log.extra)"
      >
        {{ t('copy') }}
      </v-btn>
        <v-card-text class="pt-0">
          <pre
            class="text-body-small"
          ><code>{{ formatExtra(log.extra) }}</code></pre>
        </v-card-text>
      </v-card>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { dayjs } = useLocaleDayjs()
const session = useSession()
const { sendUiNotif } = useUiNotif()

type LogEntry = {
  date: string
  type: string
  msg: Record<string, any>
  progress: number
  total: number
  progressDate: string
  extra?: Record<string, any> | string
}

defineProps({
  logs: { type: Array, required: true }
})

const expanded = ref<Record<string, boolean>>({})

const isSuperadmin = computed(() => !!session.state.user?.adminMode)

const hasExtra = (log: LogEntry) => {
  if (!log.extra) return false
  if (typeof log.extra === 'string') return log.extra.length > 0
  return Object.keys(log.extra).length > 0
}

const formatExtra = (extra: LogEntry['extra']) =>
  typeof extra === 'string' ? extra : JSON.stringify(extra, null, 2)

const copyExtra = async (extra: LogEntry['extra']) => {
  await navigator.clipboard.writeText(formatExtra(extra))
  sendUiNotif({ type: 'success', msg: t('extraCopied') })
}

const taskColor = (log: LogEntry) => {
  if (log.progress && log.progress === log.total) return 'success'
  return 'primary'
}

const logTextClass = (log: LogEntry) => {
  if (log.type === 'warning') return 'text-warning'
  if (log.type === 'debug') return 'text-admin text-medium-emphasis'
  return ''
}

const formatDate = (date: string) => dayjs(date).format('lll')
</script>

<i18n lang="yaml">
  en:
    viewExtra: View extra
    copy: Copy
    extraCopied: Extra copied to clipboard

  fr:
    viewExtra: Voir l'extra
    copy: Copier
    extraCopied: Extra copié dans le presse-papier
</i18n>

<style scoped>
</style>
