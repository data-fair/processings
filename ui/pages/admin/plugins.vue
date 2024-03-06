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
    />
    <template
      v-for="result in filteredInstalledPlugins"
      v-else
    >
      <v-card
        v-if="result.pluginConfigSchema"
        :key="'installed-' + result.id"
        class="my-1"
        variant="outlined"
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
      <v-list-subheader>Plugins disponibles</v-list-subheader>
      <v-progress-linear
        v-if="!availablePlugins.results"
        indeterminate
      />
      <v-list-item
        v-for="result in filteredAvailablePlugins"
        v-else
        :key="'available-' + result.name + '-' + result.version"
      >
        <v-list-item-title v-if="result.distTag === 'latest'">
          {{ result.name }} ({{ result.version }})
        </v-list-item-title>
        <v-list-item-title v-else>
          {{ result.name }} ({{ result.distTag }} - {{ result.version }})
        </v-list-item-title>
        <v-list-item-subtitle>{{ result.description }}</v-list-item-subtitle>
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
import Vjsf from '@koumoul/vjsf'
import { computed, onMounted, ref } from 'vue'
import { useStore } from '~/store/index'

const store = useStore()

const loading = ref(false)
const availablePlugins = ref({})
const installedPlugins = ref({})
const search = ref('')

const env = computed(() => store.env)
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
    store.setBreadcrumbs([{ text: 'plugins' }])
    await fetchInstalledPlugins()
    await fetchAvailablePlugins()
  }
})

window.onpopstate = async () => {
  const access = await checkAccess()
  if (access === true) {
    store.setBreadcrumbs([{ text: 'plugins' }])
    await fetchInstalledPlugins()
    await fetchAvailablePlugins()
  }
}

async function checkAccess() {
  if (!store.user) {
    return store.error({
      message: 'Authentification nécessaire',
      statusCode: 401
    })
  }
  if (!store.isAccountAdmin) {
    return store.error({
      message: 'Vous n\'avez pas la permission d\'accéder à cette page, il faut avoir activé le mode super-administration.',
      statusCode: 403
    })
  }

  return true
}

async function fetchAvailablePlugins() {
  availablePlugins.value = await $fetch(`${env.value.publicUrl}/api/v1/plugins-registry`)
}

async function fetchInstalledPlugins() {
  installedPlugins.value = await $fetch(`${env.value.publicUrl}/api/v1/plugins`)
}

async function install(plugin) {
  loading.value = true
  await $fetch(`${env.value.publicUrl}/api/v1/plugins`, {
    method: 'POST',
    body: { ...plugin }
  })
  await fetchInstalledPlugins()
  loading.value = false
}

async function uninstall(plugin) {
  loading.value = true
  await $fetch(`${env.value.publicUrl}/api/v1/plugins/${plugin.id}`, {
    method: 'DELETE'
  })
  await fetchInstalledPlugins()
  loading.value = false
}

async function saveConfig(plugin) {
  loading.value = true
  await $fetch(`${env.value.publicUrl}/api/v1/plugins/${plugin.id}/config`, {
    method: 'PUT',
    body: { ...plugin.config }
  })
  loading.value = false
}

async function saveAccess(plugin) {
  loading.value = true
  await $fetch(`${env.value.publicUrl}/api/v1/plugins/${plugin.id}/access`, {
    method: 'PUT',
    body: { ...plugin.access }
  })
  loading.value = false
}
</script>

<style>
</style>
