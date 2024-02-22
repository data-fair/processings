<template>
  <v-container data-iframe-height>
    <v-text-field
      v-model="search"
      placeholder="rechercher"
      outlined
      dense
      hide-details
      clearable
      style="max-width:400px;"
      append-icon="mdi-magnify"
    />
    <v-subheader>Plugins Installés</v-subheader>
    <v-progress-linear
      v-if="!installedPlugins.results"
      indeterminate
    />
    <template
      v-for="result in filteredInstalledPlugins"
      v-else
    >
      <v-card
        v-if="result.pluginConfigSchema"
        :key="'installed-' + result.id"
        class="my-1"
        outlined
        tile
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
            icon
            color="warning"
            :disabled="loading"
            @click="uninstall(result)"
          >
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-0 pb-2">
          <p class="mb-0">
            {{ result.description }}
          </p>
          <private-access
            :patch="result.access"
            @change="saveAccess(result)"
          />
          <v-form
            v-if="result.pluginConfigSchema && result.pluginConfigSchema.properties && Object.keys(result.pluginConfigSchema.properties).length"
            :ref="'form-' + result.id"
          >
            <v-jsf
              v-model="result.config"
              :schema="result.pluginConfigSchema"
              @change="saveConfig(result)"
            />
          </v-form>
        </v-card-text>
      </v-card>
    </template>
    <v-list>
      <v-subheader>Plugins disponibles</v-subheader>
      <v-progress-linear
        v-if="!availablePlugins.results"
        indeterminate
      />
      <v-list-item
        v-for="result in filteredAvailablePlugins"
        v-else
        :key="'available-' + result.name + '-' + result.version"
      >
        <v-list-item-content>
          <v-list-item-title v-if="result.distTag === 'latest'">
            {{ result.name }} ({{ result.version }})
          </v-list-item-title>
          <v-list-item-title v-else>
            {{ result.name }} ({{ result.distTag }} - {{ result.version }})
          </v-list-item-title>
          <v-list-item-subtitle>{{ result.description }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn
            title="Installer"
            icon
            color="primary"
            :disabled="loading || !installedPlugins.results || !!installedPlugins.results.find(r => r.name === result.name && r.version === result.version)"
            @click="install(result)"
          >
            <v-icon>mdi-download</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import VJsf from '@koumoul/vjsf/lib/VJsf.js'
import '@koumoul/vjsf/lib/deps/third-party.js'
import '@koumoul/vjsf/dist/main.css'
import { useStore } from '../store/index.js'
import { useAxios } from '@vueuse/integrations/useAxios'

const store = useStore()

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
  store.setBreadcrumbs([{ text: 'plugins' }])
  await fetchAvailablePlugins()
  await fetchInstalledPlugins()
})

async function fetchAvailablePlugins() {
  const { data } = await useAxios('/api/v1/plugins-registry')
  availablePlugins.value = data.value
}

async function fetchInstalledPlugins() {
  const { data } = await useAxios('/api/v1/plugins')
  installedPlugins.value = data.value
}

async function install(plugin) {
  loading.value = true
  await useAxios.post('/api/v1/plugins', plugin)
  await fetchInstalledPlugins()
  loading.value = false
}

async function uninstall(plugin) {
  loading.value = true
  await useAxios.delete('/api/v1/plugins/' + plugin.id)
  await fetchInstalledPlugins()
  loading.value = false
}

async function saveConfig(plugin) {
  loading.value = true
  await useAxios.put(`/api/v1/plugins/${plugin.id}/config`, plugin.config)
  loading.value = false
}

async function saveAccess(plugin) {
  loading.value = true
  await useAxios.put(`/api/v1/plugins/${plugin.id}/access`, plugin.access)
  loading.value = false
}
</script>

<style scoped>
</style>
