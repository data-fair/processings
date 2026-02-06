<template>
  <v-container data-iframe-height>
    <v-text-field
      v-model="search"
      :append-inner-icon="mdiMagnify"
      :placeholder="t('searchPlaceholder')"
      class="my-2"
      color="primary"
      density="compact"
      max-width="400"
      variant="outlined"
      clearable
      hide-details
    />

    <v-list-subheader>
      <v-progress-circular
        v-if="installedPluginsFetch.loading.value"
        color="primary"
        size="16"
        width="2"
        indeterminate
      />
      <v-icon
        v-else-if="installedPluginsFetch.error.value"
        :icon="mdiAlert"
        color="error"
      />
      <template v-else-if="installedPluginsFetch.data.value">
        {{ installedPluginsFetch.data.value.count }}
      </template>
      {{ t('installedPluginsLabel') }}
    </v-list-subheader>
    <v-skeleton-loader
      v-if="installedPluginsFetch.loading.value"
      :class="$vuetify.theme.current.dark ? 'my-4' : 'my-4 skeleton'"
      :height="100"
      type="list-item-two-line"
    />

    <v-card
      v-for="result in filteredInstalledPlugins"
      :key="'installed-' + result.id"
      :loading="pluginLocked === `${result.id}` ? 'primary' : false"
      class="mb-4"
    >
      <v-toolbar
        :title="result.distTag === 'latest' ? result.name : result.name + ' (' + result.distTag + ')'"
        density="compact"
        variant="outlined"
        flat
      >
        <template #append>
          {{ t('usageCount', { count: result.usages }) }} - {{ result.version }}
          <template v-if="updateInfoById[result.id]?.available">
            <v-btn
              v-if="!updateInfoById[result.id]?.isMajor"
              :disabled="!!pluginLocked"
              :icon="mdiUpdate"
              :title="t('updateWithVersion', { version: updateInfoById[result.id]?.version })"
              color="primary"
              @click="update(result)"
            />
            <v-menu
              v-else
              :key="`major-update-${result.id}`"
              :close-on-content-click="false"
              max-width="500"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  :disabled="!!pluginLocked"
                  :icon="mdiUpdate"
                  :title="t('updateWithVersion', { version: updateInfoById[result.id]?.version })"
                  color="warning"
                  @click="showMajorUpdateMenu = result.id"
                />
              </template>
              <v-card v-if="showMajorUpdateMenu === result.id">
                <v-card-title primary-title>
                  {{ t('majorUpdateTitleWithVersions', { from: result.version, to: updateInfoById[result.id]?.version }) }}
                </v-card-title>
                <v-progress-linear
                  v-if="pluginLocked === `${result.id}`"
                  color="warning"
                  indeterminate
                />
                <v-card-text>
                  {{ t('majorUpdateBody') }}
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn
                    :disabled="!!pluginLocked"
                    @click="showMajorUpdateMenu = null"
                  >
                    {{ t('cancel') }}
                  </v-btn>
                  <v-btn
                    :disabled="!!pluginLocked"
                    color="warning"
                    variant="flat"
                    @click="showMajorUpdateMenu = null; update(result)"
                  >
                    {{ t('update') }}
                  </v-btn>
                  <v-btn
                    :disabled="!!pluginLocked"
                    color="primary"
                    variant="flat"
                    @click="showMajorUpdateMenu = null; installParallel(result)"
                  >
                    {{ t('installSeparately') }}
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-menu>
          </template>
          <v-menu
            :key="result.id"
            :close-on-content-click="false"
            max-width="500"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :disabled="!!pluginLocked"
                :icon="mdiDelete"
                :title="t('uninstall')"
                color="warning"
                @click="showDeleteMenu = result.id"
              />
            </template>
            <v-card v-if="showDeleteMenu">
              <v-card-title primary-title>
                {{ t('uninstallTitle') }}
              </v-card-title>
              <v-progress-linear
                v-if="pluginLocked === `${result.id}`"
                color="warning"
                indeterminate
              />
              <v-card-text>
                {{ t('uninstallConfirm', { name: result.name }) }}
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn
                  :disabled="!!pluginLocked"
                  @click="showDeleteMenu = null"
                >
                  {{ t('no') }}
                </v-btn>
                <v-btn
                  :disabled="!!pluginLocked"
                  color="warning"
                  variant="flat"
                  @click="uninstall.execute(result)"
                >
                  {{ t('yes') }}
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </template>
      </v-toolbar>

      <v-card-text class="py-2">
        <p
          v-if="result.description"
          class="mb-2"
        >
          {{ result.description }}
        </p>
        <private-access
          :patch="result.access"
          @change="(newAccess: any) => { result.access = newAccess; save(result, 'access') }"
        />
        <v-form
          :ref="'form-metadata-' + result.id"
          class="mt-4"
          autocomplete="off"
        >
          <vjsf
            v-model="result.metadata"
            :options="vjsfOptions"
            :schema="result.pluginMetadataSchema"
            @update:model-value="save(result, 'metadata')"
          />
        </v-form>
        <v-form
          :ref="'form-config-' + result.id"
          v-model="valid['form-config-' + result.id]"
          autocomplete="off"
        >
          <vjsf
            v-if="result.pluginConfigSchema.properties && Object.keys(result.pluginConfigSchema.properties).length"
            v-model="result.config"
            :options="vjsfOptions"
            :schema="result.pluginConfigSchema"
            @update:model-value="valid['form-config-' + result.id] ? save(result, 'config') : null"
          />
        </v-form>
      </v-card-text>
    </v-card>

    <v-list-subheader>
      <v-progress-circular
        v-if="availablePluginsFetch.loading.value"
        color="primary"
        size="16"
        width="2"
        indeterminate
      />
      <span v-else-if="filteredAvailablePlugins">
        {{ filteredAvailablePlugins.length }}
      </span>
      {{ t('availablePluginsLabel') }}

      <v-menu
        v-model="showManualInstallMenu"
        :close-on-content-click="false"
        max-width="500"
      >
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :disabled="!!pluginLocked"
            class="mx-4"
            size="x-small"
            variant="tonal"
          >
            {{ t('manualInstall') }}
          </v-btn>
        </template>
        <v-card
          :loading="install.loading.value ? 'warning' : false"
          :title="t('manualInstallTitle')"
        >
          <v-card-text class="pb-0">
            <div class="mb-4">
              <p class="text-body-2 font-italic mb-2">
                {{ t('manualInstallFromNpm') }}
              </p>
              <v-text-field
                v-model="manualInstallPlugin.name"
                :disabled="!!pluginLocked || !!selectedFile"
                :label="t('manualInstallName')"
                :loading="availablePluginsFetch.loading.value"
                placeholder="@data-fair/processing-my-plugin"
                class="mb-2"
                autofocus
                hide-details
              />
              <v-text-field
                v-model="manualInstallPlugin.version"
                :disabled="!!pluginLocked || !!selectedFile"
                :label="t('manualInstallVersion')"
                placeholder="1.0.0"
                class="mb-2"
                hide-details
              />
              <v-text-field
                v-model="manualInstallPlugin.distTag"
                :disabled="!!pluginLocked || !!selectedFile"
                :label="t('manualInstallDistTag')"
                placeholder="latest"
                hide-details
              />
            </div>

            <div>
              <p class="text-body-2 font-italic mb-2">
                {{ t('manualInstallFromFile') }}
              </p>
              <v-file-input
                v-model="selectedFile"
                :disabled="!!pluginLocked || hasNpmFields"
                :label="t('manualInstallFileLabel')"
                accept=".tgz"
                chips
                hide-details
                show-size
              />
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              :disabled="!!pluginLocked || install.loading.value"
              @click="resetManualInstall()"
            >
              {{ t('cancel') }}
            </v-btn>
            <v-btn
              :disabled="!!pluginLocked || !canForceInstall || install.loading.value"
              color="warning"
              @click="install.execute()"
            >
              {{ t('install') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
    </v-list-subheader>

    <v-checkbox
      v-model="query.showAll"
      :label="t('showAllLabel')"
      color="primary"
      density="compact"
    />

    <template v-if="availablePluginsFetch.loading.value">
      <v-skeleton-loader
        v-for="n in 4"
        :key="n"
        :class="$vuetify.theme.current.dark ? 'my-4' : 'my-4 skeleton'"
        :height="100"
        type="list-item-two-line"
      />
    </template>

    <v-card
      v-for="result in filteredAvailablePlugins"
      v-else
      :key="'available-' + result.id"
      :loading="pluginLocked === `${result.id}` ? 'primary' : false"
      class="mb-4"
    >
      <v-toolbar
        :title="result.distTag === 'latest' ? result.name : result.name + ' (' + result.distTag + ')'"
        dense
        flat
      >
        <template #append>
          {{ result.version }}
          <v-btn
            :disabled="!!pluginLocked"
            :icon="mdiDownload"
            :title="t('install')"
            color="primary"
            @click="install.execute(result)"
          />
        </template>
      </v-toolbar>
      <v-card-text
        v-if="result.description"
        class="py-2"
      >
        <p class="mb-0">
          {{ result.description }}
        </p>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import Vjsf, { type Options as VjsfOptions } from '@koumoul/vjsf'
import { v2compat } from '@koumoul/vjsf/compat/v2'
import { compare, gt, major } from 'semver'

const { t } = useI18n()
const session = useSession()
const search = useStringSearchParam('q')
const query = ref({ showAll: false })
const valid = ref<Record<string, boolean>>({})

if (!session.state.user) throw new Error(t('authRequired'))
if (!session.state.user?.adminMode) throw new Error(t('adminRequired'))
setBreadcrumbs([{ text: t('pluginsBreadcrumb') }])

type AvailablePlugin = {
  id?: string // Calculated from name version and distTag
  name: string
  description?: string
  distTag: string
  version: string
}

type InstalledPlugin = {
  usages: number
  name: string
  description: string
  distTag: string
  version: string
  id: string
  config: Record<string, any>
  access: Record<string, any>
  metadata: Record<string, any>
  pluginConfigSchema: Record<string, any>
  pluginMetadataSchema: Record<string, any>
}

const installedPluginsFetch = useFetch<{
  results: InstalledPlugin[],
  facets: { usages: Record < string, number> },
  count: number
}>(`${$apiPath}/plugins`)

/** Build a stable key for grouping plugins by name and dist tag. */
const pluginKey = (name: string, distTag: string) => `${name}::${distTag}`

const availablePluginsFetch = useFetch<{
  results: AvailablePlugin[],
  count: number
}>(`${$apiPath}/plugins-registry`, { query: query.value })

/** Sort registry plugins and inject computed ids. */
const availablePlugins = computed(() => {
  const results = availablePluginsFetch.data.value?.results || []
  results.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  results.forEach(r => { r.id = generatePluginId(r.name, r.version, r.distTag) })
  return results
})

const showDeleteMenu = ref(null) as Ref<string | null>
const showMajorUpdateMenu = ref(null) as Ref<string | null>
const showManualInstallMenu = ref<boolean>(false)
const pluginLocked = ref(null) as Ref<string | null>
const manualInstallPlugin = ref<AvailablePlugin>({ name: '', version: '', distTag: 'latest' })
const selectedFile = ref<File>()

/** Fast lookup of available plugins by key. */
const availableByKey = computed(() => {
  const map = new Map<string, AvailablePlugin>()
  for (const plugin of availablePlugins.value) {
    map.set(pluginKey(plugin.name, plugin.distTag), plugin)
  }
  return map
})

/** Assign usage count and normalize schema for VJSF v3. */
const installedPlugins = computed(() => {
  const results = installedPluginsFetch.data.value?.results || []
  const usages = installedPluginsFetch.data.value?.facets.usages || {}
  return results.map(r => ({
    ...r,
    pluginConfigSchema: v2compat(r.pluginConfigSchema),
    usages: usages[r.id] || 0
  }))
})

/** Keep the latest installed version per plugin key. */
const latestInstalledByKey = computed(() => {
  const map = new Map<string, InstalledPlugin>()
  for (const plugin of installedPlugins.value) {
    const key = pluginKey(plugin.name, plugin.distTag)
    const current = map.get(key)
    if (!current || compare(plugin.version, current.version) > 0) {
      map.set(key, plugin)
    }
  }
  return map
})

/**
 * Precompute update availability for each installed plugin.
 * A plugin is updatable if there's an available version with a higher version number than the latest installed one.
 * We also detect whether the update is a major version change to warn the user about potential breaking changes.
 * @return A map of plugin id to update info, including availability, latest version and whether it's a major update.
 */
const updateInfoById = computed(() => {
  const info: Record<string, { available: boolean, version: string, isMajor: boolean }> = {}
  for (const plugin of installedPlugins.value) {
    const key = pluginKey(plugin.name, plugin.distTag)
    const latestInstalled = latestInstalledByKey.value.get(key)
    const available = availableByKey.value.get(key)

    if (!latestInstalled || !available || latestInstalled.id !== plugin.id) {
      info[plugin.id] = { available: false, version: '', isMajor: false }
      continue
    }

    if (!gt(available.version, latestInstalled.version)) {
      info[plugin.id] = { available: false, version: '', isMajor: false }
      continue
    }

    const installedMajor = major(latestInstalled.version)
    const availableMajor = major(available.version)
    info[plugin.id] = {
      available: true,
      version: available.version,
      isMajor: availableMajor > installedMajor
    }
  }
  return info
})

/** Filter installed plugins by search term. */
const filteredInstalledPlugins = computed(() => {
  if (!search.value) return installedPlugins.value
  return installedPlugins.value
    .filter(r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

/** Filter registry plugins by search term, excluding already installed ones. */
const filteredAvailablePlugins = computed(() => {
  const filteredPlugins = availablePlugins.value.filter(result =>
    !installedPlugins.value.find(r => r.id === result.id)
  )

  if (!search.value) return filteredPlugins
  return filteredPlugins
    .filter(r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

/** Detect whether any npm fields are filled for manual install. */
const hasNpmFields = computed(() =>
  !!(manualInstallPlugin.value.name?.trim() || manualInstallPlugin.value.version?.trim())
)

/** Ensure enough info is provided to install manually. */
const canForceInstall = computed(() => {
  if (hasNpmFields.value) return manualInstallPlugin.value.name && manualInstallPlugin.value.version && manualInstallPlugin.value.distTag
  if (selectedFile.value) return true
  return false
})

/** Reset manual install form state. */
const resetManualInstall = () => {
  showManualInstallMenu.value = false
  manualInstallPlugin.value = { name: '', version: '', distTag: 'latest' }
  selectedFile.value = undefined
}

/** Build a stable plugin id from name, major version and dist tag. */
const generatePluginId = (name: string, version: string, distTag: string) => {
  let id = name.replace('/', '-') + '-' + major(version)
  if (distTag && distTag !== 'latest') id += '-' + distTag
  return id
}

/** Install a plugin from registry or a local tgz file. */
const install = useAsyncAction(
  async (plugin?: AvailablePlugin) => {
    if (!canForceInstall.value && !plugin) return

    let body: FormData | AvailablePlugin

    // From a file
    if (selectedFile.value) {
      body = new FormData()
      body.append('file', selectedFile.value)

    // From npm registry
    } else {
      const pluginPost = plugin || manualInstallPlugin.value
      pluginLocked.value = `${pluginPost.id || generatePluginId(pluginPost.name, pluginPost.version, pluginPost.distTag)}`
      body = {
        name: pluginPost.name,
        version: pluginPost.version,
        distTag: pluginPost.distTag
      }
    }

    await $fetch('/plugins', {
      method: 'POST',
      body
    })
    installedPluginsFetch.refresh()
    pluginLocked.value = null
    resetManualInstall()
  },
  {
    error: t('installError'),
    success: t('installSuccess')
  }
)

/** Uninstall a plugin by id. */
const uninstall = useAsyncAction(
  async (plugin: InstalledPlugin) => {
    pluginLocked.value = `${plugin.name}-${plugin.distTag}`
    await $fetch(`/plugins/${plugin.id}`, {
      method: 'DELETE'
    })
    installedPluginsFetch.refresh()
    pluginLocked.value = null
    showDeleteMenu.value = null
  },
  {
    error: t('uninstallError'),
    success: t('uninstallSuccess')
  }
)

/** Install the next major version as a separate plugin entry. */
const installParallel = async (plugin: InstalledPlugin) => {
  const availablePlugin = availablePlugins.value.find(r => r.name === plugin.name && r.distTag === plugin.distTag)
  if (!availablePlugin) return
  await install.execute(availablePlugin)
}

/** Update the currently installed plugin to the latest available version. */
const update = async (plugin: InstalledPlugin) => {
  pluginLocked.value = `${plugin.name}-${plugin.distTag}`
  if (availablePlugins.value.length === 0) return false
  const availablePlugin = availablePlugins.value.find(r => r.name === plugin.name)
  if (availablePlugin && availablePlugin.version !== plugin.version) {
    await install.execute(availablePlugin)
  }
  pluginLocked.value = null
}

/** Persist config/access/metadata changes for a plugin. */
const save = async (plugin: InstalledPlugin, type: 'config' | 'access' | 'metadata') => {
  pluginLocked.value = `${plugin.name}-${plugin.distTag}`
  await $fetch(`/plugins/${plugin.id}/${type}`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin[type] })
  })
  pluginLocked.value = null
}

/** Shared VJSF options for schema-driven forms. */
const vjsfOptions = computed<VjsfOptions>(() => ({
  density: 'compact',
  initialValidation: 'always',
  locale: session.lang.value,
  titleDepth: 4,
  updateOn: 'blur',
  xI18n: true
}))

</script>

<i18n lang="yaml">
fr:
  adminRequired: Vous n'avez pas la permission d'accéder à cette page, il faut avoir activé le mode super-administration.
  authRequired: Authentification nécessaire
  availablePluginsLabel: plugins disponibles
  cancel: Annuler
  install: Installer
  installError: Erreur lors de l'installation du plugin
  installSeparately: Installer séparément
  installSuccess: Plugin installé !
  installedPluginsLabel: plugins installés
  majorUpdateBody: Mettre à jour vers une nouvelle version majeure risque d'entraîner une rupture de compatibilité. Vous pouvez choisir de confirmer la montée en version, ou préférer l'installation de la nouvelle version séparée.
  majorUpdateTitleWithVersions: "Mise à jour majeure - {from} vers {to}"
  manualInstall: Installer manuellement
  manualInstallDistTag: Tag de distribution
  manualInstallFileLabel: Sélectionner un fichier .tgz
  manualInstallFromFile: Installer depuis un fichier
  manualInstallFromNpm: Installer depuis npm
  manualInstallName: Nom du plugin
  manualInstallTitle: Installation manuelle d'un plugin
  manualInstallVersion: Version du plugin
  no: Non
  pluginsBreadcrumb: Plugins
  searchPlaceholder: rechercher
  showAllLabel: Afficher les versions de test des plugins
  uninstall: Désinstaller
  uninstallConfirm: Voulez-vous vraiment désinstaller le plugin "{name}" ?
  uninstallError: Erreur lors de la désinstallation du plugin
  uninstallSuccess: Plugin désinstallé !
  uninstallTitle: Désinstallation du plugin
  update: Mettre à jour
  updateWithVersion: Mettre à jour ({version})
  usageCount: Utilisé {count} fois
  yes: Oui
</i18n>
