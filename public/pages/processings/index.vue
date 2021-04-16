<template>
  <v-container data-iframe-height>
    <v-row>
      <v-col :style="$vuetify.breakpoint.lgAndUp ? 'padding-right:256px;' : ''">
        <v-container>
          <v-subheader>{{ (processings && processings.count) || 0 }} traitements</v-subheader>
          <v-row v-if="processings">
            <v-col
              v-for="processing in processings.results"
              :key="processing._id"
              md="4"
              sm="6"
              cols="12"
            >
              <processing-card :processing="processing" />
            </v-col>
          </v-row>
        </v-container>
      </v-col>
      <layout-navigation-right v-if="$vuetify.breakpoint.lgAndUp">
        <v-list dense class="list-actions">
          <v-menu
            v-model="showCreateMenu"
            :close-on-content-click="false"
            min-width="500px"
            max-width="500px"
          >
            <template #activator="{ on, attrs }">
              <v-list-item v-bind="attrs" v-on="on">
                <v-list-item-icon>
                  <v-icon color="primary">
                    mdi-plus-circle
                  </v-icon>
                </v-list-item-icon>
                <v-list-item-title>Créer un nouveau traitement</v-list-item-title>
              </v-list-item>
            </template>
            <v-card v-if="newProcessing">
              <v-card-title primary-title>
                <h3 class="text-h5 mb-0">
                  Créer un nouveau traitement
                </h3>
              </v-card-title>
              <v-card-text>
                <v-form>
                  <v-text-field
                    v-model="newProcessing.title"
                    name="title"
                    label="Titre"
                  />
                  <v-select
                    v-model="newProcessing.plugin"
                    label="Plugin"
                    :loading="!installedPlugins.results"
                    :items="installedPlugins.results"
                    item-text="name"
                    item-value="id"
                  />
                </v-form>
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn text @click="showCreateMenu = false">
                  Annuler
                </v-btn>
                <v-btn
                  :disabled="!newProcessing.title || !newProcessing.plugin"
                  color="primary"
                  @click="createProcessing(newProcessing); showCreateMenu = false"
                >
                  Enregistrer
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-list>
      </layout-navigation-right>
    </v-row>
  </v-container>
</template>

<script>
  import format from '~/assets/format.js'
  import eventBus from '~/event-bus'

  export default {
    components: {},
    middleware: 'superadmin-required',
    data: () => ({
      processings: null,
      installedPlugins: {},
      showCreateMenu: false,
      newProcessing: {},
    }),
    watch: {},
    created() {
      this.$store.dispatch('setBreadcrumbs', [{
        text: 'traitements',
      }])
      this.refresh()
      this.fetchInstalledPlugins()
    },
    methods: {
      async fetchInstalledPlugins() {
        this.installedPlugins = await this.$axios.$get('/api/v1/plugins')
      },
      datasetUrl(datasetId) {
        return process.env.datasetsUrlTemplate.replace('{id}', datasetId)
      },
      async refresh() {
        try {
          this.processings = await this.$axios.$get(process.env.publicUrl + '/api/v1/processings', { params: { size: 1000 } })
          this.processings.results.forEach(async processing => {
            if (processing.dataset && processing.dataset.id) {
              processing.dataset = await this.$axios.$get(process.env.localDataFairUrl + '/api/v1/datasets/' + processing.dataset.id)
            }
          })
        } catch (error) {
          eventBus.$emit('notification', { error, msg: 'Erreur pendant la récupération de la liste des traitements' })
        }
      },
      async createProcessing(processing) {
        const newProcessing = await this.$axios.$post(process.env.publicUrl + '/api/v1/processings', processing)
        this.$router.push(`/processings/${newProcessing._id}`)
      },
      async run(processing) {
        try {
          await this.$axios.$post(process.env.publicUrl + '/api/v1/processings/' + processing.id + '/_run')
          this.refresh()
        } catch (error) {
          eventBus.$emit('notification', { error, msg: 'Erreur pendant le changement de statut du traitement' })
        }
      },
      format,
    },
  }
</script>
