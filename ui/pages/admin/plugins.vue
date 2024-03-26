<template>
  <v-container data-iframe-height>
    <v-text-field
      v-model="search"
      placeholder="rechercher"
      variant="outlined"
      density="compact"
      hide-details
      clearable
      rounded="xl"
      style="max-width:400px;"
      class="my-2"
      color="primary"
      append-inner-icon="mdi-magnify"
    />
    <v-checkbox
      v-model="showAll"
      label="Afficher tous les plugins"
      color="primary"
      class="my-2"
      @update:model-value="fetchAvailablePlugins"
    />
    <v-list-subheader>{{ (installedPlugins.results && installedPlugins.results.length) || 0 }} plugins installés</v-list-subheader>
    <v-progress-linear
      v-if="!installedPlugins.results"
      indeterminate
      color="primary"
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
        <v-toolbar
          dense
          flat
        >
          <v-toolbar-title>
            {{ result.name }}
          </v-toolbar-title>
          <v-spacer />
          {{ result.version }}
          <v-btn
            v-if="updateAvailable(result)[0]"
            :title="`Mettre à jour ${updateAvailable(result)[1]}`"
            icon="mdi-update"
            color="primary"
            :disabled="loading"
            @click="update(result)"
          />
          <v-menu
            :key="result.id"
            v-model="showDeleteMenu[result.id]"
            :close-on-content-click="false"
            max-width="500"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                title="Désinstaller"
                icon="mdi-delete"
                color="warning"
                :disabled="loading"
              />
            </template>
            <v-card
              rounded="lg"
              variant="elevated"
            >
              <v-card-title primary-title>
                Suppression du plugin
              </v-card-title>
              <v-progress-linear
                v-if="inDelete"
                indeterminate
                color="warning"
              />
              <v-card-text>
                Voulez-vous vraiment supprimer le plugin "{{ result.fullName }}" ?
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn
                  variant="text"
                  :disabled="inDelete"
                  @click="showDeleteMenu[result.id] = false"
                >
                  Non
                </v-btn>
                <v-btn
                  color="warning"
                  :disabled="inDelete"
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
          <v-form
            v-if="result.pluginConfigSchema?.properties && Object.keys(result.pluginConfigSchema.properties).length"
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
    <v-list-subheader>{{ (availablePlugins.results && availablePlugins.results.length) || 0 }} plugins disponibles</v-list-subheader>
    <v-progress-linear
      v-if="!availablePlugins.results || reloading"
      indeterminate
      color="primary"
    />
    <template
      v-for="result in filteredAvailablePlugins"
      v-else
      :key="'available-' + result.name + '-' + result.version"
    >
      <v-card
        v-if="installedPlugins.results && !installedPlugins.results.find(/** @param {Record<String, any>} r */ r => r.name === result.name && r.distTag === result.distTag)"
        class="my-4"
        variant="elevated"
        rounded="lg"
      >
        <v-progress-linear
          v-if="inInstall[result.name]"
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
            :disabled="loading"
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
import { computed, onMounted, ref, watch } from 'vue'
import { v2compat } from '@koumoul/vjsf/compat/v2'
import { useSession } from '@data-fair/lib/vue/session.js'

const session = useSession()

const /** @type {Ref<Record<String, any>>} */ availablePlugins = ref({})
const inDelete = ref(false)
const /** @type {Ref<Record<String, any>>} */ inInstall = ref({})
const /** @type {Ref<Record<String, any>>} */ installedPlugins = ref({})
const loading = ref(false)
const reloading = ref(false)
const /** @type {Ref<Record<String, any>>} */ showDeleteMenu = ref({})
const search = ref('')
const showAll = ref(false)

const filteredAvailablePlugins = computed(() => {
  if (!availablePlugins.value.results) return
  if (!search.value) return availablePlugins.value.results
  return availablePlugins.value.results.filter(/** @param {Record<String, any>} r */ r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

const filteredInstalledPlugins = computed(() => {
  if (!installedPlugins.value.results) return
  if (!search.value) return installedPlugins.value.results
  return installedPlugins.value.results.filter(/** @param {Record<String, any>} r */ r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

function updateShowDeleteMenu() {
  const /** @type {Record<String, any>} */ menuState = {}
  installedPlugins.value.results.forEach(/** @param {Record<String, any>} plugin */ plugin => {
    menuState[plugin.id] = false
  })
  showDeleteMenu.value = menuState
}

onMounted(async () => {
  const access = await checkAccess()
  if (access === true) {
    await Promise.all([
      fetchInstalledPlugins(),
      fetchAvailablePlugins()
    ])
  }
})

window.onpopstate = async () => {
  const access = await checkAccess()
  if (access === true) {
    await fetchInstalledPlugins()
    await fetchAvailablePlugins()
  }
}

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
  reloading.value = true
  let url = '/api/v1/plugins-registry'
  if (showAll.value) {
    url += '?showAll=true'
  }
  const /** @type {Record<String, any>} */ response = await $fetch(url)
  availablePlugins.value = {
    results: response.results.sort((/** @type {Record<String, any>} */ a, /** @type {Record<String, any>} */ b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  }
  availablePlugins.value.results.forEach(/** @param {Record<String, any>} plugin */ plugin => {
    if (!(plugin.name in inInstall.value)) {
      inInstall.value[plugin.name] = false
    }
  })
  reloading.value = false
}

async function fetchInstalledPlugins() {
  const /** @type {Record<String, any>} */ response = await $fetch('/api/v1/plugins')
  installedPlugins.value = {
    results: response.results.sort((/** @type {Record<String, any>} */ a, /** @type {Record<String, any>} */ b) => a.name.localeCompare(b.name))
  }
  updateShowDeleteMenu()
}

/**
 * @param {Record<String, any>} plugin
 */
async function install(plugin) {
  loading.value = true
  inInstall.value[plugin.name] = true
  await $fetch('/api/v1/plugins', {
    method: 'POST',
    body: JSON.stringify({ ...plugin })
  })
  // TODO just update the installed plugin instead of fetching all, the plugin id is returned by the POST
  await fetchInstalledPlugins()
  inInstall.value[plugin.name] = false
  loading.value = false
}

/**
 * @param {Record<String, any>} plugin
 */
async function uninstall(plugin) {
  loading.value = true
  inDelete.value = true
  await $fetch(`/api/v1/plugins/${plugin.id}`, {
    method: 'DELETE'
  })
  await fetchInstalledPlugins()
  loading.value = false
  inDelete.value = false
  showDeleteMenu.value[plugin.id] = false
}

/**
 * @param {Record<String, any>} plugin
 */
function updateAvailable(plugin) {
  if (!availablePlugins.value.results) return [false, '']
  const availablePlugin = availablePlugins.value.results.find(/** @param {Record<String, any>} r */ r => r.name === plugin.name)
  if (availablePlugin &&
    availablePlugin.distTag === plugin.distTag &&
    availablePlugin.version !== plugin.version) return [true, availablePlugin.version]
  return [false, '']
}

/**
 * @param {Record<String, any>} plugin
 */
async function update(plugin) {
  loading.value = true
  if (!availablePlugins.value.results) return false
  const availablePlugin = availablePlugins.value.results.find(/** @param {Record<String, any>} r */ r => r.name === plugin.name)
  if (availablePlugin && availablePlugin.version !== plugin.version) {
    await install(availablePlugin)
  }
  loading.value = false
}

/**
 * @param {Record<String, any>} plugin
 */
async function saveConfig(plugin) {
  loading.value = true
  await $fetch(`/api/v1/plugins/${plugin.id}/config`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin.config })
  })
  loading.value = false
}

/**
 * @param {Record<String, any>} plugin
 */
async function saveAccess(plugin) {
  loading.value = true
  await $fetch(`/api/v1/plugins/${plugin.id}/access`, {
    method: 'PUT',
    body: JSON.stringify({ ...plugin.access })
  })
  loading.value = false
}

watch(filteredInstalledPlugins, (value) => {
  for (const result of value) {
    result.pluginConfigSchema = v2compat(result.pluginConfigSchema)
  }
})
</script>

<style>
</style>
