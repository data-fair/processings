<template>
  <v-container data-iframe-height>
    <v-text-field
      v-model="search"
      placeholder="rechercher"
      variant="outlined"
      density="compact"
      hide-details
      clearable
      style="max-width:400px;"
      append-icon="mdi-magnify"
    />
    <v-list-subheader>Plugins Installés</v-list-subheader>
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
        class="my-2"
        variant="outlined"
        border="primary md"
        rounded="lg"
      >
        <v-toolbar
          dense
          flat
        >
          <v-toolbar-title>
            {{ result.fullName }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            title="Désinstaller"
            icon="mdi-delete"
            color="warning"
            :disabled="loading"
            @click="uninstall(result)"
          />
        </v-toolbar>

        <v-card-text class="py-2">
          <p class="mb-0">
            {{ result.description }}
          </p>
          <private-access
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
    <v-list-subheader>Plugins disponibles</v-list-subheader>
    <v-progress-linear
      v-if="!availablePlugins.results"
      indeterminate
      color="primary"
    />
    <template
      v-for="result in filteredAvailablePlugins"
      v-else
      :key="'available-' + result.name + '-' + result.version"
    >
      <v-card
        class="my-2"
        variant="elevated"
        rounded="lg"
      >
        <v-toolbar
          dense
          flat
        >
          <v-toolbar-title>
            {{ result.distTag === 'latest' ? result.name + ' (' + result.version + ')' : result.name + ' (' + result.distTag + ' - ' + result.version + ')' }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            title="Installer"
            icon="mdi-download"
            color="primary"
            :disabled="loading || !installedPlugins.results || !!installedPlugins.results.find(r => r.name === result.name && r.version === result.version)"
            @click="install(result)"
          />
        </v-toolbar>
        <v-card-text class="py-2">
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

const loading = ref(false)
const availablePlugins = ref({})
const installedPlugins = ref({})
const search = ref('')

const filteredAvailablePlugins = computed(() => {
  if (!availablePlugins.value.results) return
  if (!search.value) return availablePlugins.value.results
  return availablePlugins.value.results.filter(r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

const filteredInstalledPlugins = computed(() => {
  if (!installedPlugins.value.results) return
  if (!search.value) return installedPlugins.value.results
  return installedPlugins.value.results.filter(r => r.name.includes(search.value) || (r.description && r.description.includes(search.value)))
})

onMounted(async () => {
  const access = await checkAccess()
  if (access === true) {
    await fetchInstalledPlugins()
    await fetchAvailablePlugins()
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
    // TODO: show an error message
    // return store.error({
    //   message: 'Authentification nécessaire',
    //   statusCode: 401
    // })
  }
  if (!session.state.user?.adminMode) {
    // TODO: show an error message
    // return store.error({
    //   message: 'Vous n\'avez pas la permission d\'accéder à cette page, il faut avoir activé le mode super-administration.',
    //   statusCode: 403
    // })
  }

  return true
}

async function fetchAvailablePlugins() {
  availablePlugins.value = await $fetch('/api/v1/plugins-registry')
}

async function fetchInstalledPlugins() {
  installedPlugins.value = await $fetch('/api/v1/plugins')
}

async function install(plugin) {
  loading.value = true
  await $fetch('/api/v1/plugins', {
    method: 'POST',
    body: { ...plugin }
  })
  await fetchInstalledPlugins()
  loading.value = false
}

async function uninstall(plugin) {
  loading.value = true
  await $fetch(`/api/v1/plugins/${plugin.id}`, {
    method: 'DELETE'
  })
  await fetchInstalledPlugins()
  loading.value = false
}

async function saveConfig(plugin) {
  loading.value = true
  await $fetch(`/api/v1/plugins/${plugin.id}/config`, {
    method: 'PUT',
    body: { ...plugin.config }
  })
  loading.value = false
}

async function saveAccess(plugin) {
  loading.value = true
  await $fetch(`/api/v1/plugins/${plugin.id}/access`, {
    method: 'PUT',
    body: { ...plugin.access }
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
