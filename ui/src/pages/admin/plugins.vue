<template>
  <v-container data-iframe-height>
    <v-text-field
      v-model="urlSearchParams.q"
      append-inner-icon="mdi-magnify"
      class="my-2"
      clearable
      color="primary"
      density="compact"
      hide-details
      placeholder="rechercher"
      style="max-width:400px;"
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
      >
        mdi-alert
      </v-icon>
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
    <template
      v-for="result in filteredInstalledPlugins"
      v-else
    >
      <v-card
        v-if="result.pluginConfigSchema"
        :key="'installed-' + result.id"
        class="mb-4"
      >
        <v-progress-linear
          v-if="pluginLocked === `${result.name}-${result.distTag}`"
          indeterminate
          color="primary"
        />
        <v-toolbar
          density="compact"
          flat
          variant="outlined"
        >
          <v-toolbar-title>
            {{ result.distTag === 'latest' ? result.name : result.name + ' (' + result.distTag + ')' }}
          </v-toolbar-title>
          <v-spacer />
          Utilisé {{ result.usages }} fois -
          {{ result.version }}
          <v-btn
            v-if="updateAvailable(result)[0]"
            :title="`Mettre à jour (${updateAvailable(result)[1]})`"
            icon="mdi-update"
            color="primary"
            :disabled="!!pluginLocked"
            @click="update(result)"
          />
          <v-menu
            :key="result.id"
            :close-on-content-click="false"
            max-width="500"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                title="Désinstaller"
                icon="mdi-delete"
                color="warning"
                :disabled="!!pluginLocked"
                @click="deleteMenuShowed = result.id"
              />
            </template>
            <v-card v-if="deleteMenuShowed">
              <v-card-title primary-title>
                Désinstallation du plugin
              </v-card-title>
              <v-progress-linear
                v-if="pluginLocked === `${result.name}-${result.distTag}`"
                indeterminate
                color="warning"
              />
              <v-card-text>
                Voulez-vous vraiment désinstaller le plugin "{{ result.name }}" ?
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn
                  variant="text"
                  :disabled="!!pluginLocked"
                  @click="deleteMenuShowed = null"
                >
                  Non
                </v-btn>
                <v-btn
                  color="warning"
                  :disabled="!!pluginLocked"
                  @click="uninstall(result)"
                >
                  Oui
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-toolbar>

        <v-card-text class="py-2">
          <p class="mb-0">
            {{ result.description }}
          </p>
          <PrivateAccess
            :patch="result.access"
            @change="saveAccess(result)"
          />
          <v-spacer />
          <v-form
            v-if="result.pluginConfigSchema.properties && Object.keys(result.pluginConfigSchema.properties).length"
            :ref="'form-' + result.id"
            autocomplete="off"
          >
            <vjsf
              v-model="result.config"
              :options="vjsfOptions"
              :schema="result.pluginConfigSchema"
              @change="saveConfig(result)"
            />
          </v-form>
        </v-card-text>
      </v-card>
    </template>
    <v-col>
      <v-row>
        <v-list-subheader>{{ (availablePlugins && availablePlugins.length) || 0 }} plugins disponibles</v-list-subheader>
        <v-checkbox
          :model-value="urlSearchParams.showAll === 'true'"
          label="Afficher les versions de test des plugins"
          color="primary"
          density="compact"
          @update:model-value="value => urlSearchParams.showAll = '' + value"
        />
      </v-row>
    </v-col>
    <v-col v-if="availablePluginsFetch.loading.value">
      <v-skeleton-loader
        v-for="n in 4"
        :key="n"
        :height="100"
        type="list-item-two-line"
        :class="$vuetify.theme.current.dark ? 'my-4' : 'my-4 skeleton'"
      />
    </v-col>
    <template
      v-for="result in filteredAvailablePlugins"
      v-else
      :key="'available-' + result.name + '-' + result.version"
    >
      <v-card
        v-if="!installedPlugins.find(r => r.name === result.name && r.distTag === result.distTag)"
        class="mb-4"
      >
        <v-progress-linear
          v-if="pluginLocked === `${result.name}-${result.distTag}`"
          indeterminate
          color="primary"
        />
        <v-toolbar
          dense
          flat
        >
          <v-toolbar-title>
            {{ result.distTag === 'latest' ? result.name : result.name + ' (' + result.distTag + ')' }}
          </v-toolbar-title>
          <v-spacer />
          {{ result.version }}
          <v-btn
            title="Installer"
            icon="mdi-download"
            color="primary"
            :disabled="!!pluginLocked"
            @click="install(result)"
          />
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
    </template>
  </v-container>
</template>

<script setup lang="ts">
import setBreadcrumbs from '~/utils/breadcrumbs'
import useUrlSearchParams from '@data-fair/lib-vue/reactive-search-params.js'
import VjsfMarkdown from '@koumoul/vjsf-markdown'
import { v2compat } from '@koumoul/vjsf/compat/v2'

const session = useSession()
const urlSearchParams = useUrlSearchParams()

if (!session.state.user) {
  throw createError({ status: 401, message: 'Authentification nécessaire', fatal: true })
}
if (!session.state.user?.adminMode) {
  throw createError({ status: 403, message: 'Vous n\'avez pas la permission d\'accéder à cette page, il faut avoir activé le mode super-administration.', fatal: true })
}

onMounted(() => setBreadcrumbs([{ text: 'plugins' }]))

type AvailablePlugin = {
  name: string
  description: string
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
  pluginConfigSchema: Record<string, any>
}

const installedPluginsFetch = useFetch<{
  results: InstalledPlugin[],
  facets: { usages: Record < string, number> },
  count: number
}>('/api/v1/plugins')

const installedPlugins = computed(() => {
  const results = installedPluginsFetch.data.value?.results || []
  const usages = installedPluginsFetch.data.value?.facets.usages || {}
  return results.map(r => ({
    ...r,
    pluginConfigSchema: v2compat(r.pluginConfigSchema),
    usages: usages[r.id] || 0
  }))
})

const availablePluginsFetch = useFetch<AvailablePlugin[]>('/api/v1/plugins-registry', { query: { showAll: urlSearchParams.showAll } })
const availablePlugins = computed(() => {
  const results = availablePluginsFetch.data.value || []
  results.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  return results
})

const filteredInstalledPlugins = computed(() => {
  if (!urlSearchParams.q) return installedPlugins.value
  return installedPlugins.value
    .filter(r => r.name.includes(urlSearchParams.q) || (r.description && r.description.includes(urlSearchParams.q)))
})

const filteredAvailablePlugins = computed(() => {
  if (!urlSearchParams.q) return availablePlugins.value
  return availablePlugins.value.filter(r => r.name.includes(urlSearchParams.q) || (r.description && r.description.includes(urlSearchParams.q)))
})

const deleteMenuShowed = ref(null) as Ref<string | null>
const pluginLocked = ref(null) as Ref<string | null>

const install = withUiNotif(
  async (plugin: AvailablePlugin) => {
    pluginLocked.value = `${plugin.name}-${plugin.distTag}`
    await $fetch('/api/v1/plugins', {
      method: 'POST',
      body: JSON.stringify(plugin)
    })
    installedPluginsFetch.refresh()
    pluginLocked.value = null
  },
  "Erreur pendant l'installation du plugin",
  { msg: 'Plugin installé avec succès !' }
)

const uninstall = withUiNotif(
  async (plugin: InstalledPlugin) => {
    pluginLocked.value = `${plugin.name}-${plugin.distTag}`
    await $fetch(`/api/v1/plugins/${plugin.id}`, {
      method: 'DELETE'
    })
    installedPluginsFetch.refresh()
    pluginLocked.value = null
    deleteMenuShowed.value = null
  },
  'Erreur pendant la désinstallation du plugin',
  { msg: 'Plugin désinstallé avec succès !' }
)

/**
 * Check if an update is available for a plugin (same distTag, same name, different version)
 * @param plugin - The plugin to check
 * @returns - A tuple with a boolean indicating if an update is available and the new version
 */
function updateAvailable (plugin: InstalledPlugin): [boolean, string] {
  if (availablePlugins.value.length === 0) return [false, '']
  const availablePlugin = availablePlugins.value.find(r => (r.name === plugin.name && r.distTag === plugin.distTag))
  if (availablePlugin &&
    availablePlugin.version !== plugin.version) return [true, availablePlugin.version]
  return [false, '']
}

async function update (plugin: InstalledPlugin) {
  pluginLocked.value = `${plugin.name}-${plugin.distTag}`
  if (availablePlugins.value.length === 0) return false
  const availablePlugin = availablePlugins.value.find(r => r.name === plugin.name)
  if (availablePlugin && availablePlugin.version !== plugin.version) {
    await install(availablePlugin)
  }
  pluginLocked.value = null
}

async function saveConfig (plugin: InstalledPlugin) {
  pluginLocked.value = `${plugin.name}-${plugin.distTag}`
  await $fetch(`/api/v1/plugins/${plugin.id}/config`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin.config })
  })
  pluginLocked.value = null
}

async function saveAccess (plugin: InstalledPlugin) {
  pluginLocked.value = `${plugin.name}-${plugin.distTag}`
  await $fetch(`/api/v1/plugins/${plugin.id}/access`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin.access })
  })
  pluginLocked.value = null
}

const vjsfOptions = computed(() => {
  return {
    plugins: [VjsfMarkdown],
    density: 'comfortable',
    locale: 'fr',
    titleDepth: 4
  }
})

</script>

<style scoped>
</style>
