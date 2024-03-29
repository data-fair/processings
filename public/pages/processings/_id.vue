<template lang="html">
  <v-container
    v-if="processing"
    data-iframe-height
  >
    <v-row>
      <v-col :style="$vuetify.breakpoint.lgAndUp ? 'padding-right:256px;' : ''">
        <h2 class="text-h6">
          Traitement {{ processing.title }}
        </h2>
        <v-form ref="form">
          <v-jsf
            v-if="processingSchema"
            :key="renderVjsfKey"
            v-model="editProcessing"
            :schema="processingSchema"
            :options="vjsfOptions"
            @change="patch"
          >
            <template #custom-time-zone="{value, disabled, on}">
              <time-zone-select
                :value="value"
                :disabled="disabled"
                v-on="on"
              />
            </template>
          </v-jsf>
        </v-form>
        <processing-runs
          ref="runs"
          :processing="processing"
          class="mt-4"
          :can-exec="canExecProcessing"
        />
      </v-col>
      <layout-navigation-right v-if="$vuetify.breakpoint.lgAndUp">
        <processing-actions
          :processing="processing"
          :can-admin="canAdminProcessing"
          :can-exec="canExecProcessing"
          @triggered="$refs.runs.refresh()"
        />
      </layout-navigation-right>
      <layout-actions-button
        v-else
        class="pt-2"
      >
        <template #actions>
          <processing-actions
            :processing="processing"
            :can-admin="canAdminProcessing"
            :can-exec="canExecProcessing"
            @triggered="$refs.runs.refresh()"
          />
        </template>
      </layout-actions-button>
    </v-row>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'
import VJsf from '@koumoul/vjsf/lib/VJsf.js'

const processingSchema = require('~/../contract/processing')

export default {
  components: { VJsf },
  data: () => ({
    processing: null,
    editProcessing: null,
    plugin: null,
    renderVjsfKey: 0
  }),
  computed: {
    ...mapState(['env']),
    ...mapState('session', ['user']),
    canAdminProcessing () {
      if (!this.processing) return
      return this.processing.userProfile === 'admin'
    },
    canExecProcessing () {
      if (!this.processing) return
      return ['admin', 'exec'].includes(this.processing.userProfile)
    },
    processingSchema () {
      if (!this.plugin) return
      if (!this.processing) return
      const schema = JSON.parse(JSON.stringify(processingSchema))
      schema.properties.config = {
        ...this.plugin.processingConfigSchema,
        title: 'Plugin ' + this.plugin.fullName,
        'x-options': { deleteReadOnly: false }
      }
      if (this.user.adminMode) delete schema.properties.debug.readOnly
      if (!this.canAdminProcessing) {
        delete schema.properties.permissions
        delete schema.properties.config
        delete schema.properties.webhookKey
      }
      return schema
    },
    vjsfOptions () {
      if (!this.processing) return
      return {
        context: {
          owner: this.processing.owner,
          ownerFilter: this.env.dataFairAdminMode ? `owner=${this.processing.owner.type}:${encodeURIComponent(this.processing.owner.id)}` : '',
          dataFairUrl: this.env.dataFairUrl,
          directoryUrl: this.env.directoryUrl
        },
        disableAll: !this.canAdminProcessing,
        locale: 'fr',
        // rootDisplay: 'expansion-panels',
        // rootDisplay: 'tabs',
        expansionPanelsProps: {
          value: 0,
          hover: true
        },
        dialogProps: {
          maxWidth: 500,
          overlayOpacity: 0 // better when inside an iframe
        },
        arrayItemCardProps: { outlined: true, tile: true },
        dialogCardProps: { outlined: true },
        deleteReadOnly: true,
        editMode: 'inline',
        disableSorting: true
      }
    }
  },
  async mounted () {
    if (this.$route.query['back-link'] === 'true') {
      this.$store.commit('setAny', { runBackLink: true })
    }
    await this.fetchProcessing()
    this.plugin = await this.$axios.$get('api/v1/plugins/' + this.processing.plugin)
    this.editProcessing = { ...this.processing }
    Object.keys(this.processingSchema.properties).forEach(key => {
      if (this.processingSchema.properties[key].readOnly) delete this.editProcessing[key]
    })
  },
  methods: {
    async fetchProcessing () {
      this.processing = await this.$axios.$get('api/v1/processings/' + this.$route.params.id)
      this.$store.dispatch('setBreadcrumbs', [{
        text: 'traitements',
        to: '/processings'
      }, {
        text: this.processing.title
      }])
    },
    async patch () {
      if (!this.$refs.form.validate()) return
      if (this.editProcessing.scheduling && this.editProcessing.scheduling.type === 'weekly') {
        if (this.editProcessing.scheduling.dayOfWeek === '*') this.editProcessing.scheduling.dayOfWeek = '1'
        this.renderVjsfKey += 1
      }
      await this.$axios.$patch('api/v1/processings/' + this.$route.params.id, this.editProcessing)
      await this.fetchProcessing()
    }
  }
}
</script>
