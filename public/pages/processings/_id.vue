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
            v-model="editProcessing"
            :schema="processingSchema"
            :options="vjsfOptions"
            @change="patch"
          />
        </v-form>
        <processing-runs
          ref="runs"
          :processing="processing"
          class="mt-4"
        />
      </v-col>
      <layout-navigation-right v-if="$vuetify.breakpoint.lgAndUp">
        <processing-actions
          :processing="processing"
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
  middleware: 'contrib-required',
  data: () => ({
    processing: null,
    editProcessing: null,
    plugin: null
  }),
  computed: {
    ...mapState(['env']),
    ...mapState('session', ['user']),
    processingSchema () {
      if (!this.plugin) return
      const schema = JSON.parse(JSON.stringify(processingSchema))
      schema.properties.config = {
        ...this.plugin.processingConfigSchema,
        title: 'Plugin ' + this.plugin.fullName,
        'x-options': { deleteReadOnly: false }
      }
      return schema
    },
    vjsfOptions () {
      if (!this.processing) return
      return {
        context: {
          owner: this.processing.owner,
          ownerFilter: this.env.dataFairAdminMode ? `owner=${this.processing.owner.type}:${encodeURIComponent(this.processing.owner.id)}` : '',
          dataFairUrl: this.env.dataFairUrl
        },
        disableAll: !this.user.adminMode,
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
        deleteReadOnly: true
      }
    }
  },
  async mounted () {
    if (this.$route.query['back-link'] === 'true') {
      this.$store.commit('setAny', { runBackLink: true })
    }
    await this.fetchProcessing()
    this.editProcessing = { ...this.processing }
    Object.keys(processingSchema.properties).forEach(key => {
      if (processingSchema.properties[key].readOnly) delete this.editProcessing[key]
    })
    this.plugin = await this.$axios.$get('api/v1/plugins/' + this.processing.plugin)
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
    async patch (patch) {
      if (!this.$refs.form.validate()) return
      await this.$axios.$patch('api/v1/processings/' + this.$route.params.id, patch)
      await this.fetchProcessing()
    }
  }
}
</script>
