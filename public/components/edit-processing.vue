<template>
  <v-tooltip top>
    <template v-slot:activator="{ on }">
      <v-btn :fab="!processingId" :right="!processingId" :text="!!processingId" :absolute="!processingId" v-on="on" @click="stepper=0;dialog=true">
        <v-icon v-if="!processingId" color="primary">
          mdi-plus
        </v-icon>
        <v-icon v-else color="primary">
          mdi-pencil
        </v-icon>
      </v-btn>
    </template>
    <span>{{ processingId ? 'Editer' : 'Ajouter' }} un traitement</span>
    <v-dialog v-model="dialog" :fullscreen="$vuetify.breakpoint.mdAndDown" :max-width="1200">
      <v-card v-if="dialog" class="px-3">
        <v-toolbar dense flat>
          <v-toolbar-title>{{ processingId ? 'Editer' : 'Ajouter' }} un traitement</v-toolbar-title>
          <v-spacer />
          <v-btn icon @click.native="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <v-form ref="form" v-model="valid">
            <v-jsf v-if="processingSchema" v-model="processing" :options="{hideReadOnly: true}" :schema="processingSchema" @error="error => eventBus.$emit('notification', {error})" />
          </v-form>
          <v-row class="px-5" align="center">
            <v-text-field v-model="newDatasetTitle" label="Titre du nouveau jeu de données" />
            <v-btn :disabled="!processing.source || !processing.source.type || !newDatasetTitle" text @click="createDataset(processing)">
              Créer un jeu de données
            </v-btn>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click.native="dialog = false">
            Annuler
          </v-btn>
          <v-btn v-if="valid" color="primary" @click.native="confirm">
            Enregistrer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-tooltip>
</template>

<script>
import VJsf from '@koumoul/vjsf/lib/VJsf.js'
import eventBus from '../event-bus'

function schemaIncluded(smallSchema, largerSchema) {
  for (const field of smallSchema) {
    if (!largerSchema.find(s => s.key === field.key && s.type === field.type)) return false
  }
  return true
}

export default {
  components: { VJsf },
  props: {
    processingId: { type: String, default: null }
  },
  data() {
    return {
      eventBus,
      dialog: null,
      valid: false,
      processing: {},
      newDatasetTitle: null,
      processingSchema: null
    }
  },
  watch: {
    'processing.source.type'() {
      if (this.dialog) this.fetchDatasets()
    },
    'processing.owner'() {
      if (this.dialog) this.fetchDatasets()
    }
  },
  async mounted() {
    if (this.processingId) this.processing = await this.$axios.$get(process.env.publicUrl + '/api/v1/processings/' + this.processingId)
    this.processingSchema = await this.$axios.$get(process.env.publicUrl + '/api/v1/processings/_schema')
    this.fetchDatasets()
  },
  methods: {
    async confirm () {
      console.log('confirm')
      if (this.$refs.form.validate()) {
        try {
          if (this.processingId) {
            const patch = JSON.parse(JSON.stringify(this.processing))
            delete patch.status
            await this.$axios.$patch(process.env.publicUrl + '/api/v1/processings/' + this.processingId, patch)
            this.$emit('updated', { id: this.processingId })
          } else {
            const processing = await this.$axios.$post(process.env.publicUrl + '/api/v1/processings', this.processing)
            this.$emit('created', { id: processing.id })
          }
        } catch (error) {
          eventBus.$emit('notification', { error, msg: 'Erreur pendant la creation du traitement' })
        } finally {
          this.dialog = false
        }
      }
    },
    async fetchDatasets() {
      try {
        if (this.processingSchema) {
          const params = { size: 1000, select: 'title,id,schema' }
          if (this.processing.owner) {
            params.owner = 'organization:' + this.processing.owner.id
          }
          let datasets = (await this.$axios.$get(process.env.publicUrl + '/data-fair/api/v1/datasets', { params })).results
          if (this.processing.source && this.processing.source.type) {
            const schema = require('../../sources/' + this.processing.source.type + '/schema.json')
            datasets = datasets.filter(d => schemaIncluded(schema, d.schema))
          }
          this.$set(this.processingSchema.properties.dataset, 'enum', datasets.map(d => ({ id: d.id, title: d.title })))
        }
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la récupération de la liste des jeux de données' })
      }
    },
    async createDataset(processing) {
      const dataset = {
        // title: 'Etat des stations du service VLS Vélocéo de Vannes',
        title: this.newDatasetTitle,
        isRest: true,
        rest: {},
        schema: require('../../sources/' + this.processing.source.type + '/schema.json')
      }
      if (processing.owner) {
        dataset.owner = processing.owner
      }
      try {
        await this.$axios.$post(process.env.publicUrl + '/data-fair/api/v1/datasets', dataset)
        this.fetchDatasets()
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la création du jeu de données' })
      }
    }
  }
}

</script>
