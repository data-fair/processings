<template>
  <card-shell
    :title="processing.title"
    :to="`/processings/${processing._id}`"
    :owner="showOwner ? processing.owner : undefined"
  >
    <!-- Plugin name -->
    <card-meta-line
      v-if="pluginFetch.error.value?.statusCode"
      :icon="mdiPowerPlug"
      color="error"
      :text="t('pluginUnavailable') + ' — ' + processing.plugin"
    >
      <template #help>
        {{ t('pluginUnavailableHint') }}
      </template>
    </card-meta-line>
    <card-meta-line
      v-else
      :icon="mdiPowerPlug"
      icon-color="primary"
      :text="pluginFetch.data.value?.title?.fr ?? pluginFetch.data.value?.title?.en ?? pluginFetch.data.value?.name ?? processing.plugin"
    />

    <!-- Linked dataset -->
    <card-meta-line
      v-if="processing.config?.dataset?.id"
      :icon="mdiDatabase"
      icon-color="primary"
      :text="processing.config.dataset.title || processing.config.dataset.id"
    />

    <!-- Next run -->
    <card-meta-line
      v-if="processing.nextRun?.status === 'scheduled'"
      :icon="mdiClockOutline"
      icon-color="primary"
      :text="t('nextRunScheduled') + ' ' + dayjs(processing.nextRun.scheduledAt).fromNow()"
    >
      <template
        v-if="processing.scheduling?.length"
        #help
      >
        <div
          v-for="(scheduling, i) in processing.scheduling"
          :key="i"
        >
          {{ t(`frequency.${scheduling.type}`) }}
          {{ cronstrue.toString(toCRON(scheduling), { locale: locale }) }}
        </div>
      </template>
    </card-meta-line>
    <card-meta-line
      v-else-if="processing.nextRun?.status === 'triggered'"
      :icon="mdiPlayCircle"
      icon-color="primary"
      :text="t('nextRunTriggered') + ' ' + dayjs(processing.nextRun.createdAt).fromNow()"
    />

    <template #footer>
      <!-- Active or inactive -->
      <card-hover-info
        :title="processing.active ? t('active') : t('inactive')"
        :icon="processing.active ? mdiToggleSwitch : mdiToggleSwitchOff"
        :icon-color="processing.active ? 'success' : 'error'"
      >
        <v-icon
          :icon="processing.active ? mdiToggleSwitch : mdiToggleSwitchOff"
          :color="processing.active ? 'success' : 'error'"
          size="18"
        />
        <span class="d-sr-only">{{ processing.active ? t('active') : t('inactive') }}</span>
        <template #help>
          {{ processing.active ? t('activeHelp') : t('inactiveHelp') }}
        </template>
      </card-hover-info>
      <!-- Last run status, on the right -->
      <v-spacer />
      <card-state-info v-bind="state" />
    </template>
  </card-shell>
</template>

<script setup lang="ts">
import { mdiClockOutline } from '@mdi/js'
import cronstrue from 'cronstrue'
import 'cronstrue/locales/en'
import 'cronstrue/locales/fr'
import { toCRON } from '@data-fair/processings-shared/runs.ts'
import cardShell from '~/components/card/card-shell.vue'
import cardMetaLine from '~/components/card/card-meta-line.vue'
import cardHoverInfo from '~/components/card/card-hover-info.vue'
import cardStateInfo from '~/components/card/card-state-info.vue'

const { t, locale } = useI18n()
const { dayjs } = useLocaleDayjs()

const props = defineProps({
  pluginName: {
    type: String,
    default: null
  },
  processing: {
    type: Object,
    default: null
  },
  showOwner: Boolean
})

const pluginFetch = usePluginFetch(props.processing._id)

const state = computed(() => {
  const run = props.processing.lastRun
  if (!run) return { icon: mdiInformation, text: t('noRuns'), help: t('noRunsHelp') }
  const when = dayjs(run.finishedAt ?? run.startedAt).fromNow()
  const duration = run.startedAt && run.finishedAt ? dayjs(run.finishedAt).from(run.startedAt, true) : null
  const withDuration = (text: string) => duration ? `${text} · ${t('duration')} ${duration}` : text
  if (run.status === 'finished') return { icon: mdiCheckCircle, color: 'success', text: when, title: t('lastRunFinished'), help: withDuration(`${t('finished')} ${when}`) }
  if (run.status === 'error') return { icon: mdiAlert, color: 'error', text: `${t('failed')} ${when}`, title: t('lastRunError'), help: withDuration(`${t('failedHelp')} ${when}`), strong: true }
  if (run.status === 'running') return { icon: mdiCheckCircle, color: 'primary', text: t('running'), title: t('runRunning'), help: `${t('runStarted')} ${dayjs(run.startedAt).fromNow()}`, loading: true }
  if (run.status === 'kill' || run.status === 'killed') return { icon: mdiStop, color: 'accent', text: `${t('killed')} ${when}`, title: t('lastRunKilled'), help: `${t('killed')} ${when}` }
  return { icon: mdiInformation, text: t('noRuns'), help: t('noRunsHelp') }
})
</script>

<i18n lang="yaml">
  en:
    pluginUnavailable: Plugin unavailable
    pluginUnavailableHint: This processing's plugin has been removed or its access revoked. You can no longer edit or run it, but you can view its history and delete it.
    runStarted: Started
    runRunning: Run in progress
    running: Running
    lastRunFinished: Last run finished
    finished: Finished
    duration: duration
    lastRunError: Last run failed
    failed: Failed
    failedHelp: Failed
    lastRunKilled: Last run interrupted
    killed: Interrupted
    noRuns: Never run
    noRunsHelp: No runs in history
    nextRunScheduled: Next run
    nextRunTriggered: Run triggered manually
    frequency:
      daily: Every day,
      hours: ''
      monthly: Every month,
      weekly: Every week,
    active: Active
    inactive: Inactive
    activeHelp: The processing runs according to its schedule.
    inactiveHelp: The processing does not run until it is reactivated.

  fr:
    pluginUnavailable: Plugin indisponible
    pluginUnavailableHint: Le plugin de ce traitement a été supprimé ou son accès retiré. Vous ne pouvez plus le modifier ni l'exécuter, mais vous pouvez consulter son historique et le supprimer.
    runStarted: Commencée
    runRunning: Exécution en cours
    running: En cours
    lastRunFinished: Dernière exécution terminée
    finished: Terminée
    duration: durée
    lastRunError: Dernière exécution en échec
    failed: Échec
    failedHelp: En échec
    lastRunKilled: Dernière exécution interrompue
    killed: Interrompue
    noRuns: Jamais exécuté
    noRunsHelp: Aucune exécution dans l'historique
    nextRunScheduled: Prochaine exécution
    nextRunTriggered: Exécution déclenchée manuellement
    frequency:
      daily: Tous les jours,
      hours: ''
      monthly: Tous les mois,
      weekly: Toutes les semaines,
    active: Actif
    inactive: Inactif
    activeHelp: Le traitement s'exécute selon sa planification.
    inactiveHelp: Le traitement ne s'exécute pas tant qu'il n'est pas réactivé.

</i18n>
