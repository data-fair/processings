<template>
  <v-container
    v-if="processing"
    data-iframe-height
  >
    <v-alert
      v-if="pluginBroken"
      type="error"
      variant="tonal"
      class="mb-4"
      :title="t('pluginUnavailableTitle')"
    >
      {{ t('pluginUnavailableBody') }}
      <br>
      <code>{{ processing?.plugin }}</code>
    </v-alert>
    <h2 class="text-headline-small">
      {{ t('processingTitle', { title: processing.title }) }}
    </h2>
    <v-defaults-provider
      :defaults="{
        global: {
          hideDetails: 'auto'
        },
        VAutocomplete: {
          persistentPlaceholder: true,
          placeholder: t('search')
        },
        VNumberInput: {
          inset: true
        }
      }"
    >
      <v-form
        v-model="valid"
        autocomplete="off"
      >
        <vjsf
          v-if="processingSchema && !pluginBroken"
          v-model="editProcessing"
          :schema="processingSchema"
          :options="vjsfOptions"
          @update:model-value="patch.execute()"
        >
          <template #activity>
            <processing-activity
              :processing="Object.assign(processing, editProcessing)"
              :plugin-title="plugin?.title?.fr ?? plugin?.title?.en ?? plugin?.name"
            />
          </template>
          <template #scheduling-summary="{ node }">
            {{ t(`frequency.${node.data.type}`) }}
            {{ cronstrue.toString(toCRON(node.data), { locale: session.lang.value }) }}
            {{ timezoneLabel(node.data.timeZone) }}
          </template>
        </vjsf>
        <v-skeleton-loader
          v-else-if="pluginFetchPending && !pluginBroken"
          type="heading, list-item-three-line, list-item-three-line, list-item-two-line, actions"
        />
      </v-form>
    </v-defaults-provider>
    <processing-runs
      ref="runs"
      :can-exec="canExecProcessing"
      :processing="processing"
      class="mt-4"
    />

    <navigation-right v-if="processing">
      <processing-actions
        :processing="processing"
        :processing-schema="processingSchema"
        :can-admin="canAdminProcessing"
        :can-exec="canExecProcessing"
        :edited="edited"
        :is-small="false"
        :documentation="plugin?.documentation"
        :plugin-broken="pluginBroken"
        @triggered="runs && runs.refresh()"
      />
    </navigation-right>
  </v-container>
</template>

<script setup lang="ts">
import type { Processing } from '#api/types'

import cronstrue from 'cronstrue'
import 'cronstrue/locales/en'
import 'cronstrue/locales/fr'

import type { RegistryArtefact } from '~/composables/use-plugin-fetch'

import useFetch from '@data-fair/lib-vue/fetch.js'
import { resolvedSchema as contractProcessing } from '#api/types/processing/index.ts'
import timeZones from 'timezones.json'
import Vjsf, { type Options as VjsfOptions } from '@koumoul/vjsf'
import { v2compat } from '@koumoul/vjsf/compat/v2'
import { toCRON } from '@data-fair/processings-shared/runs.ts'
import NavigationRight from '@data-fair/lib-vuetify/navigation-right.vue'

const { t } = useI18n()
const route = useRoute<'/processings/[id]/'>()
const session = useSession()

const processingId = route.params.id
const utcs: string[] = []
for (const tz of timeZones) {
  for (const utc of tz.utc) {
    if (!utcs.includes(utc)) utcs.push(utc)
  }
}

const valid = ref(false)
const edited = ref(false)
const editProcessing: Ref<Processing | null> = ref(null)
const processing: Ref<Processing | null> = ref(null)
const runs: Ref<Record<string, any>> = ref([])

/*
  Fetch initial data
*/

onMounted(async () => {
  await fetchProcessing()
  setBreadcrumbs([{
    text: t('processings'),
    to: '/processings'
  }, {
    text: processing.value?.title || ''
  }])
})

async function fetchProcessing () {
  processing.value = await $fetch(`/processings/${processingId}`)
  if (processing.value) editProcessing.value = { ...processing.value }
}

/*
  Plugin metadata + config schema fetches.

  Both kick off in parallel as soon as `processing` resolves — useFetch
  watches its reactive URL and waits while it's null.

  - pluginBroken: 404 (deleted) or 403 (access revoked) on the artefact.
    Surfaces the banner and suppresses the form.
  - configSchema null: legitimate "this plugin ships no schema" — distinct
    from a registry error and does NOT trigger the banner.

  Same-domain assumption: registry is mounted at `/registry` of the current
  domain, so an absolute path bypasses `$fetch`'s `/processings/api/v1`
  baseURL (which would rewrite `/registry/...` to a 404).
*/
const pluginFetch = useFetch<RegistryArtefact>(
  computed(() => processing.value?.plugin
    ? `/registry/api/v1/artefacts/${encodeURIComponent(processing.value.plugin)}`
    : null),
  { notifError: false }
)
const plugin = computed(() => pluginFetch.data.value)
const pluginBroken = computed(() => {
  const status = pluginFetch.error.value?.statusCode
  return status === 404 || status === 403
})

const configSchemaFetch = useFetch<Record<string, unknown>>(
  computed(() => processing.value?.plugin
    ? `${$apiPath}/processings/${processingId}/plugin-config-schema`
    : null),
  { notifError: false }
)
const configSchema = computed<Record<string, unknown> | null>(() => {
  const err = configSchemaFetch.error.value
  // The endpoint returns 404 to mean "this plugin doesn't ship a schema"; we
  // collapse that to null so the page degrades gracefully (no form, no
  // banner). Other errors are left to surface through the data binding.
  if (err && (err.statusCode === 404 || err.status === 404)) return null
  return configSchemaFetch.data.value
})

const pluginFetchPending = computed(() =>
  pluginFetch.loading.value || configSchemaFetch.loading.value
)

/*
  Permissions
*/

const canAdminProcessing = computed(() => {
  if (!processing.value) return false
  return processing.value.userProfile === 'admin'
})
const canExecProcessing = computed(() => {
  if (!processing.value) return false
  return ['admin', 'exec'].includes(processing.value.userProfile || '')
})

/*
  Preparation for the vjsf form
*/

const processingSchema = computed(() => {
  if (!plugin.value || !processing.value) return
  const pluginConfigSchema = configSchema.value as any
  if (!pluginConfigSchema) return
  const schema = JSON.parse(JSON.stringify(contractProcessing))
  schema.properties.config = {
    ...v2compat(pluginConfigSchema),
    title: 'Plugin ' + (plugin.value.title?.fr ?? plugin.value.title?.en ?? plugin.value.name)
  }

  // merge processingConfigSchema $defs and definitions into the global Processing schema
  if (pluginConfigSchema.$defs) {
    schema.$defs = { ...schema.$defs, ...pluginConfigSchema.$defs }
    delete schema.properties.config.$defs
  }
  if (pluginConfigSchema.definitions) {
    schema.definitions = { ...schema.definitions, ...pluginConfigSchema.definitions }
    delete schema.properties.config.definitions
  }
  delete schema.properties.config.$id

  // remove readOnly properties for debug if in admin mode
  if (session.state.user?.adminMode) delete schema.properties.debug?.readOnly

  // remove configs for non-admin users
  if (!canAdminProcessing.value) {
    delete schema.layout
    delete schema.title
    delete schema.properties.title
    delete schema.properties.permissions
    delete schema.properties.config
    delete schema.required
  } else {
    schema.required = ['title', 'scheduling', 'config', 'permissions']
    schema.properties.config.required = schema.properties.config.required?.filter((s: any) => s !== 'datasetMode')
  }

  return schema
})

const vjsfOptions = computed<VjsfOptions>(() => ({
  context: {
    owner: processing.value?.owner,
    // ownerFilter: runtimeConfig.public.dataFairAdminMode ? `owner=${ownerFilter.value}` : '',
    ownerFilter: `owner=${processing.value?.owner.type}:${processing.value?.owner.id}${processing.value?.owner.department ? ':' + processing.value?.owner.department : ''}`,
    dataFairUrl: window.location.origin + $sitePath + '/data-fair',
    directoryUrl: window.location.origin + $sitePath + '/simple-directory',
    utcs
  },
  density: 'comfortable',
  initialValidation: 'always',
  readOnly: !canAdminProcessing.value,
  readOnlyPropertiesMode: 'remove',
  removeAdditional: true,
  titleDepth: 3,
  locale: session.lang.value,
  updateOn: 'blur',
  validateOn: 'blur',
  xI18n: true
}))

let initialPatch = true
const patch = useAsyncAction(
  async () => {
    // the first patch is always triggered because of removed additional properties
    if (initialPatch) {
      initialPatch = false
      return
    }

    // TODO: some problem in vjsf makes it necessary to wait when adding a permission for validity to be correct
    await new Promise(resolve => setTimeout(resolve, 1))

    if (!valid.value || !canAdminProcessing.value) return
    edited.value = true

    await $fetch(`/processings/${processingId}`, {
      method: 'PATCH',
      body: editProcessing.value
    })

    if (processing.value) Object.assign(processing.value, editProcessing.value)

    edited.value = false
  },
  {
    error: t('updateError'),
  }
)

/*
  A patch can be triggered server side
*/
const patchConfigWSChannel = `processings/${processingId}/patch-config`
const ws = useWS('/processings/api/')
const onPatchConfig = () => {
  fetchProcessing()
}
onMounted(() => {
  ws?.subscribe(patchConfigWSChannel, onPatchConfig)
})
onUnmounted(() => {
  ws?.unsubscribe(patchConfigWSChannel, onPatchConfig)
})

const timezoneLabel = (timeZone: string) => {
  if (timeZone === 'Europe/Paris') return ''
  return ' — ' + t('timezone') + ' ' + timeZone ? timeZone : 'UTC'
}

</script>

<i18n lang="yaml">
  en:
    frequency:
      daily: Every day,
      hours: ''
      monthly: Every month,
      weekly: Every week,
    processings: Processings
    processingTitle: 'Processing {title}'
    search: 'Search...'
    timezone: 'Timezone:'
    updateError: Error while updating the processing
    pluginUnavailableTitle: Plugin unavailable
    pluginUnavailableBody: This processing's plugin has been removed or its access revoked. You can no longer edit or run this processing, but you can still view its run history and delete it.

  fr:
    frequency:
      daily: Tous les jours,
      hours: ''
      monthly: Tous les mois,
      weekly: Toutes les semaines,
    processings: Traitements
    processingTitle: 'Traitement {title}'
    search: 'Rechercher...'
    timezone: 'Fuseau horaire :'
    updateError: Erreur lors de la mise à jour du traitement
    pluginUnavailableTitle: Plugin indisponible
    pluginUnavailableBody: Le plugin de ce traitement a été supprimé ou son accès retiré. Vous ne pouvez plus modifier ni exécuter ce traitement, mais vous pouvez consulter son historique et le supprimer.

</i18n>

<style scoped>
</style>
