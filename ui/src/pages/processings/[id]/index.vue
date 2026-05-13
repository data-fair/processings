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
      <code>{{ processing?.pluginId }}</code>
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
import type { RegistryArtefact } from '~/composables/use-plugin-fetch'

import cronstrue from 'cronstrue'
import 'cronstrue/locales/en'
import 'cronstrue/locales/fr'

import { resolvedSchema as contractProcessing } from '#api/types/processing/index.ts'
import timeZones from 'timezones.json'
import Vjsf, { type Options as VjsfOptions } from '@koumoul/vjsf'
import { v2compat } from '@koumoul/vjsf/compat/v2'
import { toCRON } from '@data-fair/processings-shared/runs.ts'
import { parsePluginId } from '@data-fair/processings-shared/plugin-id.ts'
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
const plugin: Ref<RegistryArtefact | null> = ref(null)
const pluginBroken = ref(false)
const configSchema: Ref<Record<string, unknown> | null> = ref(null)
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
  await fetchPlugin()
})

async function fetchProcessing () {
  processing.value = await $fetch(`/processings/${processingId}`)
  if (processing.value) editProcessing.value = { ...processing.value }
}
async function fetchPlugin () {
  pluginBroken.value = false
  if (!processing.value?.pluginId) return
  const { name } = parsePluginId(processing.value.pluginId)
  // Display metadata comes from registry (artefact-level, name-keyed).
  // The config schema is read out of the cached package.json by the
  // processings API — registry doesn't know or care what's inside packages.
  //
  // Registry returns 404 when the plugin has been deleted, 403 when the
  // owner has lost access. We collapse both into pluginBroken=true and
  // render a banner; the config-schema fetch's 404 (no schema for this
  // major) is a separate, narrower state that does NOT trigger the banner.
  const artefactResult = await $fetch<RegistryArtefact>(
    `/registry/api/v1/artefacts/${encodeURIComponent(name)}`
  ).then(
    (data) => ({ ok: true as const, data }),
    (err) => {
      const status = err?.statusCode ?? err?.status
      if (status === 404 || status === 403) return { ok: false as const }
      throw err
    }
  )
  if (!artefactResult.ok) {
    pluginBroken.value = true
    return
  }
  plugin.value = artefactResult.data
  configSchema.value = await $fetch<Record<string, unknown>>(
    `/processings/${processingId}/plugin-config-schema`
  ).catch(err => {
    if (err?.statusCode === 404 || err?.status === 404) return null
    throw err
  })
}

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
