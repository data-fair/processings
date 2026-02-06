<template>
  <v-container data-iframe-height>
    <v-text-field
      v-model="search"
      :append-inner-icon="mdiMagnify"
      class="my-2"
      clearable
      color="primary"
      density="compact"
      hide-details
      placeholder="rechercher"
      max-width="400"
      variant="outlined"
    />

    <v-list-subheader>
      <v-progress-circular
        v-if="installedPluginsFetch.loading.value"
        indeterminate
        size="16"
        width="2"
        color="primary"
      />
      <v-icon
        v-else-if="installedPluginsFetch.error.value"
        color="error"
        :icon="mdiAlert"
      />
      <template v-else-if="installedPluginsFetch.data.value">
        {{ installedPluginsFetch.data.value.count }}
      </template>
      plugins installés
    </v-list-subheader>
    <v-skeleton-loader
      v-if="installedPluginsFetch.loading.value"
      :height="100"
      type="list-item-two-line"
      :class="$vuetify.theme.current.dark ? 'my-4' : 'my-4 skeleton'"
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
          Utilisé {{ result.usages }} fois - {{ result.version }}
          <template v-if="updateAvailable(result)[0]">
            <v-btn
              v-if="!updateAvailable(result)[2]"
              :title="`Mettre à jour (${updateAvailable(result)[1]})`"
              :icon="mdiUpdate"
              color="primary"
              :disabled="!!pluginLocked"
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
                  :title="`Mettre à jour (${updateAvailable(result)[1]})`"
                  :icon="mdiUpdate"
                  color="warning"
                  :disabled="!!pluginLocked"
                  @click="showMajorUpdateMenu = result.id"
                />
              </template>
              <v-card v-if="showMajorUpdateMenu === result.id">
                <v-card-title primary-title>
                  Mise à jour majeure
                </v-card-title>
                <v-progress-linear
                  v-if="pluginLocked === `${result.id}`"
                  indeterminate
                  color="warning"
                />
                <v-card-text>
                  Mettre à jour vers une nouvelle version majeure risque d'entraîner une rupture de compatibilité. Vous pouvez choisir de confirmer la montée en version, ou préférer l'installation de la nouvelle version séparée.
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn
                    :disabled="!!pluginLocked"
                    @click="showMajorUpdateMenu = null"
                  >
                    Annuler
                  </v-btn>
                  <v-btn
                    color="warning"
                    variant="flat"
                    :disabled="!!pluginLocked"
                    @click="showMajorUpdateMenu = null; update(result)"
                  >
                    Mettre à jour
                  </v-btn>
                  <v-btn
                    color="primary"
                    variant="flat"
                    :disabled="!!pluginLocked"
                    @click="showMajorUpdateMenu = null; installParallel(result)"
                  >
                    Installer séparément
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
                title="Désinstaller"
                :icon="mdiDelete"
                color="warning"
                :disabled="!!pluginLocked"
                @click="showDeleteMenu = result.id"
              />
            </template>
            <v-card v-if="showDeleteMenu">
              <v-card-title primary-title>
                Désinstallation du plugin
              </v-card-title>
              <v-progress-linear
                v-if="pluginLocked === `${result.id}`"
                indeterminate
                color="warning"
              />
              <v-card-text>
                Voulez-vous vraiment désinstaller le plugin "{{ result.name }}" ?
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn
                  :disabled="!!pluginLocked"
                  @click="showDeleteMenu = null"
                >
                  Non
                </v-btn>
                <v-btn
                  color="warning"
                  variant="flat"
                  :disabled="!!pluginLocked"
                  @click="uninstall.execute(result)"
                >
                  Oui
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
          autocomplete="off"
          class="mt-4"
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
        indeterminate
        size="16"
        width="2"
        color="primary"
      />
      <span v-else-if="filteredAvailablePlugins">
        {{ filteredAvailablePlugins.length }}
      </span>
      plugins disponibles

      <v-menu
        v-model="showManualInstallMenu"
        :close-on-content-click="false"
        max-width="500"
      >
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            class="mx-4"
            size="x-small"
            variant="tonal"
            :disabled="!!pluginLocked"
          >
            Installer manuellement
          </v-btn>
        </template>
        <v-card
          title="Installation manuelle d'un plugin"
          :loading="install.loading.value ? 'warning' : false"
        >
          <v-card-text class="pb-0">
            <div class="mb-4">
              <p class="text-body-2 font-italic mb-2">
                Installer depuis npm
              </p>
              <v-text-field
                v-model="manualInstallPlugin.name"
                class="mb-2"
                placeholder="@data-fair/processing-my-plugin"
                label="Nom du plugin"
                :loading="availablePluginsFetch.loading.value"
                :disabled="!!pluginLocked || !!selectedFile"
                autofocus
                hide-details
              />
              <v-text-field
                v-model="manualInstallPlugin.version"
                class="mb-2"
                placeholder="0.0.0"
                label="Version du plugin"
                :disabled="!!pluginLocked || !!selectedFile"
                hide-details
              />
              <v-text-field
                v-model="manualInstallPlugin.distTag"
                placeholder="latest"
                label="Tag de distribution"
                :disabled="!!pluginLocked || !!selectedFile"
                hide-details
              />
            </div>

            <div>
              <p class="text-body-2 font-italic mb-2">
                Installer depuis un fichier
              </p>
              <v-file-input
                v-model="selectedFile"
                accept=".tgz"
                label="Sélectionner un fichier .tgz"
                :disabled="!!pluginLocked || hasNpmFields"
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
              @click="showManualInstallMenu = false; manualInstallPlugin = { name: '', version: '', distTag: 'latest' }; selectedFile = undefined"
            >
              Annuler
            </v-btn>
            <v-btn
              color="warning"
              :disabled="!!pluginLocked || !canForceInstall || install.loading.value"
              @click="install.execute()"
            >
              Installer
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
    </v-list-subheader>

    <v-checkbox
      v-model="query.showAll"
      label="Afficher les versions de test des plugins"
      color="primary"
      density="compact"
    />

    <template v-if="availablePluginsFetch.loading.value">
      <v-skeleton-loader
        v-for="n in 4"
        :key="n"
        :height="100"
        type="list-item-two-line"
        :class="$vuetify.theme.current.dark ? 'my-4' : 'my-4 skeleton'"
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
            title="Installer"
            :icon="mdiDownload"
            color="primary"
            :disabled="!!pluginLocked"
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

const session = useSession()
const search = useStringSearchParam('q')
const query = ref({ showAll: false })
const valid = ref<Record<string, boolean>>({})

if (!session.state.user) {
  throw new Error('Authentification nécessaire')
}
if (!session.state.user?.adminMode) {
  throw new Error('Vous n\'avez pas la permission d\'accéder à cette page, il faut avoir activé le mode super-administration.')
}

onMounted(() => setBreadcrumbs([{ text: 'Plugins' }]))

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

// Assign usage count to each installed plugin and make old config schema compatible with vjsf 3
const installedPlugins = computed(() => {
  const results = installedPluginsFetch.data.value?.results || []
  const usages = installedPluginsFetch.data.value?.facets.usages || {}
  return results.map(r => ({
    ...r,
    pluginConfigSchema: v2compat(r.pluginConfigSchema),
    usages: usages[r.id] || 0
  }))
})

const availablePluginsFetch = useFetch<{
  results: AvailablePlugin[],
  count: number
}>(`${$apiPath}/plugins-registry`, { query: query.value })

const availablePlugins = computed(() => {
  const results = availablePluginsFetch.data.value?.results || []
  results.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  results.forEach(r => { r.id = generatePluginId(r.name, r.version, r.distTag) })
  return results
})

const filteredInstalledPlugins = computed(() => {
  if (!search.value) return installedPlugins.value
  return installedPlugins.value
    .filter(r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

const filteredAvailablePlugins = computed(() => {
  const filteredPlugins = availablePlugins.value.filter(result =>
    !installedPlugins.value.find(r => r.id === result.id)
  )

  if (!search.value) return filteredPlugins
  return filteredPlugins.filter(result =>
    result.name.includes(search.value) ||
    (result.description && result.description.includes(search.value))
  )
})

const showDeleteMenu = ref(null) as Ref<string | null>
const showMajorUpdateMenu = ref(null) as Ref<string | null>
const showManualInstallMenu = ref<boolean>(false)
const pluginLocked = ref(null) as Ref<string | null>
const manualInstallPlugin = ref<AvailablePlugin>({ name: '', version: '', distTag: 'latest' })
const selectedFile = ref<File>()

const hasNpmFields = computed(() =>
  !!(manualInstallPlugin.value.name?.trim() || manualInstallPlugin.value.version?.trim())
)

// Tue if form is valid
const canForceInstall = computed(() => {
  if (hasNpmFields.value) return manualInstallPlugin.value.name && manualInstallPlugin.value.version && manualInstallPlugin.value.distTag
  else if (selectedFile.value) return true
  return false
})

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
    showManualInstallMenu.value = false
    selectedFile.value = undefined
    manualInstallPlugin.value = { name: '', version: '', distTag: 'latest' }
  },
  {
    error: 'Erreur lors de l\'installation du plugin',
    success: 'Plugin installé !'
  }
)

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
    error: 'Erreur lors de la désinstallation du plugin',
    success: 'Plugin désinstallé !'
  }
)

/**
 * Check if an update is available for a plugin (same distTag, same name, higher major version)
 * @param plugin - The plugin to check
 * @returns - A tuple with a boolean indicating if an update is available, the new version and a major-update flag
 */
function updateAvailable (plugin: InstalledPlugin): [boolean, string, boolean] {
  if (availablePlugins.value.length === 0) return [false, '', false]
  const availablePlugin = availablePlugins.value.find(r => (r.name === plugin.name && r.distTag === plugin.distTag))
  if (!availablePlugin) return [false, '', false]

  const relatedInstalled = installedPlugins.value.filter(r => r.name === plugin.name && r.distTag === plugin.distTag)
  if (relatedInstalled.length === 0) return [false, '', false]

  let latestInstalled = relatedInstalled[0]
  for (const candidate of relatedInstalled.slice(1)) {
    const candidateParts = candidate.version.split('.')
    const latestParts = latestInstalled.version.split('.')
    let candidateIsNewer = false

    for (let i = 0; i < 3; i += 1) {
      const candidatePart = Number.parseInt(candidateParts[i] || '0', 10)
      const latestPart = Number.parseInt(latestParts[i] || '0', 10)

      if (candidatePart > latestPart) {
        candidateIsNewer = true
        break
      }
      if (candidatePart < latestPart) {
        candidateIsNewer = false
        break
      }
    }

    if (candidateIsNewer) latestInstalled = candidate
  }

  if (latestInstalled.id !== plugin.id) return [false, '', false]

  const availableParts = availablePlugin.version.split('.')
  const installedParts = latestInstalled.version.split('.')
  let availableIsNewer = false
  let versionsEqual = true

  for (let i = 0; i < 3; i += 1) {
    const availablePart = Number.parseInt(availableParts[i] || '0', 10)
    const installedPart = Number.parseInt(installedParts[i] || '0', 10)

    if (availablePart > installedPart) {
      availableIsNewer = true
      versionsEqual = false
      break
    }
    if (availablePart < installedPart) {
      availableIsNewer = false
      versionsEqual = false
      break
    }
  }

  if (versionsEqual) return [false, '', false]
  if (availableIsNewer) {
    const installedMajor = Number.parseInt(installedParts[0] || '0', 10)
    const availableMajor = Number.parseInt(availableParts[0] || '0', 10)
    const isMajorUpdate = availableMajor > installedMajor
    return [true, availablePlugin.version, isMajorUpdate]
  }
  return [false, '', false]
}

async function installParallel (plugin: InstalledPlugin) {
  const availablePlugin = availablePlugins.value.find(r => r.name === plugin.name && r.distTag === plugin.distTag)
  if (!availablePlugin) return
  await install.execute(availablePlugin)
}

async function update (plugin: InstalledPlugin) {
  pluginLocked.value = `${plugin.name}-${plugin.distTag}`
  if (availablePlugins.value.length === 0) return false
  const availablePlugin = availablePlugins.value.find(r => r.name === plugin.name)
  if (availablePlugin && availablePlugin.version !== plugin.version) {
    await install.execute(availablePlugin)
  }
  pluginLocked.value = null
}

async function save (plugin: InstalledPlugin, type: 'config' | 'access' | 'metadata') {
  pluginLocked.value = `${plugin.name}-${plugin.distTag}`
  await $fetch(`/plugins/${plugin.id}/${type}`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin[type] })
  })
  pluginLocked.value = null
}

const vjsfOptions = computed<VjsfOptions>(() => ({
  density: 'compact',
  initialValidation: 'always',
  locale: session.lang.value,
  titleDepth: 4,
  updateOn: 'blur',
  xI18n: true
}))

const generatePluginId = (name: string, version: string, distTag: string) => {
  let id = name.replace('/', '-') + '-' + version.split('.')[0]
  if (distTag && distTag !== 'latest') id += '-' + distTag
  return id
}

</script>

<style scoped>
</style>
