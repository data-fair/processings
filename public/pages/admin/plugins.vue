<template lang="html">
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

<script>
import VJsf from '@koumoul/vjsf/lib/VJsf.js'
import '@koumoul/vjsf/lib/deps/third-party.js'
import '@koumoul/vjsf/dist/main.css'

export default {
  components: { VJsf },
  middleware: 'superadmin-required',
  data: () => ({
    loading: false,
    availablePlugins: {},
    installedPlugins: {},
    search: ''
  }),
  computed: {
    filteredAvailablePlugins () {
      if (!this.availablePlugins.results) return
      if (!this.search) return this.availablePlugins.results
      return this.availablePlugins.results.filter(r => r.name.includes(this.search) || (r.description && r.description.includes(this.search)))
    },
    filteredInstalledPlugins () {
      if (!this.installedPlugins.results) return
      if (!this.search) return this.installedPlugins.results
      return this.installedPlugins.results.filter(r => r.name.includes(this.search) || (r.description && r.description.includes(this.search)))
    }
  },
  created () {
    this.$store.dispatch('setBreadcrumbs', [{ text: 'plugins' }])
    this.fetchAvailablePlugins()
    this.fetchInstalledPlugins()
  },
  methods: {
    async fetchAvailablePlugins () {
      this.availablePlugins = await this.$axios.$get('/api/v1/plugins-registry')
    },
    async fetchInstalledPlugins () {
      this.installedPlugins = await this.$axios.$get('/api/v1/plugins')
    },
    async install (plugin) {
      this.loading = true
      await this.$axios.$post('/api/v1/plugins', plugin)
      await this.fetchInstalledPlugins()
      this.loading = false
    },
    async uninstall (plugin) {
      this.loading = true
      await this.$axios.$delete('/api/v1/plugins/' + plugin.id)
      await this.fetchInstalledPlugins()
      this.loading = false
    },
    async saveConfig (plugin) {
      this.loading = true
      await this.$axios.$put(`/api/v1/plugins/${plugin.id}/config`, plugin.config)
      this.loading = false
    },
    async saveAccess (plugin) {
      this.loading = true
      await this.$axios.$put(`/api/v1/plugins/${plugin.id}/access`, plugin.access)
      this.loading = false
    }
  }
}
</script>

<style lang="css" scoped>
</style>
