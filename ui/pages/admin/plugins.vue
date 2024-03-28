<template>
  <v-container data-iframe-height>
    <v-text-field
      v-model="search"
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
    <v-list-subheader>{{ (installedPlugins && installedPlugins.length) || 0 }} plugins installés</v-list-subheader>
    <v-skeleton-loader
      v-if="!installedPlugins"
      :height="100"
      type="list-item-two-line"
      class="my-4"
    />
    <template
      v-for="result in filteredInstalledPlugins"
      v-else
    >
      <v-card
        v-if="result.pluginConfigSchema"
        :key="'installed-' + result.id"
        class="my-4"
        variant="outlined"
        border="md"
        rounded="lg"
      >
        <v-progress-linear
          v-if="pluginsLocked[`${result.name}-${result.distTag}`]"
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
            v-if="updateAvailable(result)[0]"
            :title="`Mettre à jour (${updateAvailable(result)[1]})`"
            icon="mdi-update"
            color="primary"
            :disabled="pluginsLocked[`${result.name}-${result.distTag}`]"
            @click="update(result)"
          />
          <v-menu
            :key="result.id"
            :v-model="deleteMenuShowed === result.id"
            :close-on-content-click="false"
            max-width="500"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                title="Désinstaller"
                icon="mdi-delete"
                color="warning"
                :disabled="pluginsLocked[`${result.name}-${result.distTag}`]"
              />
            </template>
            <v-card
              rounded="lg"
              variant="elevated"
            >
              <v-card-title primary-title>
                Désinstallation du plugin
              </v-card-title>
              <v-progress-linear
                v-if="pluginsLocked[`${result.name}-${result.distTag}`]"
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
                  @click="deleteMenuShowed = null"
                >
                  Non
                </v-btn>
                <v-btn
                  color="warning"
                  :disabled="pluginsLocked[`${result.name}-${result.distTag}`]"
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
          >
            <vjsf
              v-model="result.config"
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
          v-model="showAll"
          label="Afficher tous les plugins"
          color="primary"
          class="my-2"
          @update:model-value="fetchAvailablePlugins"
        />
      </v-row>
    </v-col>
    <v-col v-if="loadingAvailablePlugins">
      <v-skeleton-loader
        v-for="n in 4"
        :key="n"
        :height="100"
        type="list-item-two-line"
        class="my-4"
      />
    </v-col>
    <template
      v-for="result in filteredAvailablePlugins"
      v-else
      :key="'available-' + result.name + '-' + result.version"
    >
      <v-card
        v-if="!installedPlugins.find(/** @param {Record<String, any>} r */ r => r.name === result.name && r.distTag === result.distTag)"
        class="my-4"
        variant="elevated"
        rounded="lg"
      >
        <v-progress-linear
          v-if="pluginsLocked[`${result.name}-${result.distTag}`]"
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
            :disabled="pluginsLocked[`${result.name}-${result.distTag}`]"
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

<script setup>
import '@koumoul/vjsf-markdown'
import Vjsf from '@koumoul/vjsf'
import { computed, onMounted, ref } from 'vue'
import { v2compat } from '@koumoul/vjsf/compat/v2'
import { useSession } from '@data-fair/lib/vue/session.js'

const session = useSession()

/**
 * @typedef AvailablePlugin
 * @property {String} name
 * @property {String} description
 * @property {String} distTag
 * @property {String} version
 */

/**
* @typedef InstalledPlugin
* @property {String} name
* @property {String} description
* @property {String} distTag
* @property {String} version
* @property {String} id
* @property {Object<String, any>} config
* @property {Object<String, any>} access
* @property {Object<String, any>} pluginConfigSchema
*/

const /** @type {Ref<AvailablePlugin[]>} - A list of plugins not installed */ availablePlugins = ref([])
const /** @type {Ref<Record<String, boolean>>} - An object with in key `${result.name}-${result.distTag}`. True if installing, updating or deleting, false otherwise */ pluginsLocked = ref({})
const /** @type {Ref<InstalledPlugin[]>} - A list of installed plugins */ installedPlugins = ref([])
const /** @type {Ref<boolean>} - True if the list of availablePlugins is loading */ loadingAvailablePlugins = ref(false)
const /** @type {Ref<String | null>} - Contains the id of the plugin where the deleteMenu needs to be shown */ deleteMenuShowed = ref(null)
const /** @type {Ref<String>} */ search = ref('')
const /** @type {Ref<boolean>} */ showAll = ref(false)

const filteredAvailablePlugins = computed(() => {
  if (availablePlugins.value.length === 0) return
  if (!search.value) return availablePlugins.value
  return availablePlugins.value.filter(/** @param {Record<String, any>} r */ r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

const filteredInstalledPlugins = computed(() => {
  if (installedPlugins.value.length === 0) return
  if (!search.value) return installedPlugins.value
  installedPlugins.value.forEach(plugin => { plugin.pluginConfigSchema = v2compat(plugin.pluginConfigSchema) })
  return installedPlugins.value.filter(/** @param {Record<String, any>} r */ r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

onMounted(async () => {
  const access = await checkAccess()
  if (access === true) {
    await Promise.all([
      fetchInstalledPlugins(),
      fetchAvailablePlugins()
    ])
  }
})

async function checkAccess() {
  if (!session.state.user) {
    window.location.href = '/error?statusCode=401&message=' + encodeURIComponent('Authentification nécessaire')
    return false
  }
  if (!session.state.user?.adminMode) {
    window.location.href = '/error?statusCode=403&message=' + encodeURIComponent('Vous n\'avez pas la permission d\'accéder à cette page, il faut avoir activé le mode super-administration.')
    return false
  }

  return true
}

async function fetchAvailablePlugins() {
  loadingAvailablePlugins.value = true
  const url = '/api/v1/plugins-registry' + (showAll.value ? '?showAll=true' : '')
  const /** @type {{count: number, results: AvailablePlugin[]}} */ response = await $fetch(url)
  availablePlugins.value = response.results.sort((/** @type {AvailablePlugin} */ a, /** @type {AvailablePlugin} */ b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))

  availablePlugins.value.forEach((/** @type {AvailablePlugin} */ plugin) => {
    if (!(`${plugin.name}-${plugin.distTag}` in pluginsLocked.value)) {
      pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = false
    }
  })
  loadingAvailablePlugins.value = false
}

async function fetchInstalledPlugins() {
  const /** @type {{count: number, results: InstalledPlugin[]}} */ response = await $fetch('/api/v1/plugins')
  installedPlugins.value = response.results.sort((/** @type {InstalledPlugin} */ a, /** @type {InstalledPlugin} */ b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}

/**
 * Call the API to install a plugin
 * @param {AvailablePlugin} plugin
 */
async function install(plugin) {
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = true
  try {
    /** @type {InstalledPlugin} */
    const newPlugin = await $fetch('/api/v1/plugins', {
      method: 'POST',
      body: JSON.stringify(plugin)
    })
    const index = installedPlugins.value.findIndex(p => p.id === newPlugin.id)
    console.log(installedPlugins)
    console.log(newPlugin)
    if (index === -1) installedPlugins.value.push(newPlugin)
    else installedPlugins.value[index] = newPlugin
  } catch (e) {
    // TODO handle notification error
  } finally {
    pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = false
  }
}

/**
 * @param {InstalledPlugin} plugin
 */
async function uninstall(plugin) {
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = true
  await $fetch(`/api/v1/plugins/${plugin.id}`, {
    method: 'DELETE'
  })
  await fetchInstalledPlugins()
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = false
  deleteMenuShowed.value = null
}

/**
 * Check if an update is available for a plugin (same distTag, same name, different version)
 * @param {Record<String, any>} plugin
 * @returns {[boolean, string]} - A tuple with a boolean indicating if an update is available and the new version
 */
function updateAvailable(plugin) {
  if (availablePlugins.value.length === 0) return [false, '']
  const availablePlugin = availablePlugins.value.find(/** @param {AvailablePlugin} r */ r => (r.name === plugin.name && r.distTag === plugin.distTag))
  if (availablePlugin &&
    availablePlugin.version !== plugin.version) return [true, availablePlugin.version]
  return [false, '']
}

/**
 * @param {Record<String, any>} plugin
 */
async function update(plugin) {
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = true
  if (availablePlugins.value.length === 0) return false
  const availablePlugin = availablePlugins.value.find(/** @param {Record<String, any>} r */ r => r.name === plugin.name)
  if (availablePlugin && availablePlugin.version !== plugin.version) {
    await install(availablePlugin)
  }
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = false
}

/**
 * @param {Record<String, any>} plugin
 */
async function saveConfig(plugin) {
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = true
  await $fetch(`/api/v1/plugins/${plugin.id}/config`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin.config })
  })
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = false
}

/**
 * @param {Record<String, any>} plugin
 */
async function saveAccess(plugin) {
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = true
  await $fetch(`/api/v1/plugins/${plugin.id}/access`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin.access })
  })
  pluginsLocked.value[`${plugin.name}-${plugin.distTag}`] = false
}

</script>

<style>
</style>
