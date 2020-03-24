<template lang="html">
  <span>
    <span>{{ (sourceType && sourceType.title) || 'Non défini' }}</span>
    <v-tooltip v-if="processing" top>
      <template v-slot:activator="{ on }">
        <v-btn text style="height:20px" v-on="on" @click="dialog=!noModal">
          <v-icon color="primary" size="20">
            mdi-information
          </v-icon>
        </v-btn>
      </template>
      <span>{{ noModal ? sourceType && sourceType.description : 'Description du traitement' }}</span>
      <v-dialog v-model="dialog" :fullscreen="$vuetify.breakpoint.mdAndDown" :max-width="1200">
        <v-card class="py-3">
          <v-simple-table>
            <template v-slot:default>
              <thead>
                <tr>
                  <th class="text-center" style="width:45%">
                    Entrée
                  </th>
                  <th style="width:10%" />
                  <th class="text-center" style="width:45%">
                    Données interopérables
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-center">{{ sourceType.description }}</td>
                  <td class="text-center">
                    <v-icon x-large color="primary">
                      mdi-arrow-right
                    </v-icon>
                  </td>
                  <td class="text-center">
                    <v-simple-table>
                      <template v-slot:default>
                        <tbody>
                          <tr>
                            <td class="text-left">Description</td>
                            <td>
                              {{ sourceType['x-output'] }}
                            </td>
                          </tr>
                          <tr v-if="datasetSchema">
                            <td class="text-left">Champs</td>
                            <td>
                              {{ datasetSchema.map(f => f.key).join(', ') }}
                            </td>
                          </tr>
                          <tr v-if="datasetSchema">
                            <td class="text-left">Concepts</td>
                            <td>
                              <v-chip v-for="concept in datasetSchema.filter(f => f['x-refersTo']).map(f => conceptLabel(f['x-refersTo']))" :key="concept" color="primary" class="ma-1">
                                {{ concept }}
                              </v-chip>
                            </td>
                          </tr>
                        </tbody>
                      </template>
                    </v-simple-table>
                    <!-- {{ vocabulary }} -->
                    <!-- <template v-for="output in props.item.output">
            <v-chip v-if="vocabulary[output.concept]" :key="output.concept" :title="vocabulary[output.concept].description" style="margin:4px 4px;">
              {{ vocabulary[output.concept].title }}
            </v-chip>
          </template> -->
                  </td>
                </tr>
              </tbody>
            </template>
          </v-simple-table>
        </v-card>
      </v-dialog>
    </v-tooltip>
  </span>
</template>

<script>

export default {
  props: {
    processing: { type: Object, required: true },
    noModal: { type: Boolean, default: false }
  },
  data() {
    return {
      dialog: null,
      vocabulary: [],
      processingSchema: null
    }
  },
  computed: {
    sourceType() {
      return this.processingSchema && this.processingSchema.properties.source.oneOf.find(s => s.properties.type.const === this.processing.source.type)
    },
    datasetSchema() {
      try {
        return require('../../sources/' + this.processing.source.type + '/schema.json')
      } catch (err) {
        console.log('No schema for processing type')
      }
      return null
    }
  },
  async mounted() {
    this.vocabulary = await this.$axios.$get(process.env.dataFairUrl + '/api/v1/vocabulary')
    this.processingSchema = await this.$axios.$get(process.env.publicUrl + '/api/v1/processings/_schema')
  },
  methods: {
    conceptLabel(uri) {
      const concept = this.vocabulary.find(t => t.identifiers.find(i => i === uri))
      if (concept) return concept.title
      return 'Concept inconnu'
    }
  }
}
</script>
