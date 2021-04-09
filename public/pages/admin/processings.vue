<template>
  <v-row>
    <v-col :style="$vuetify.breakpoint.lgAndUp ? 'padding-right:256px;' : ''">
      <v-container>
        <v-subheader>{{ (processings && processings.count) || 0 }} traitements</v-subheader>
        <v-row v-if="processings">
          <v-col
            v-for="processing in processings.results"
            :key="processing.id"
            md="4"
            sm="6"
            cols="12"
          >
            <v-card
              :elevation="4"
              class="fill-height"
              style="display:flex;flex-direction:column;"
            >
              <v-card-title class="text-h6 px-1">
                <v-col class="text-center pa-0">
                  {{ processing.title | truncate(32) }}
                </v-col>
              </v-card-title>
              <v-divider />

              <v-card-text class="px-0 pt-0" style="flex: 1;">
                <v-list>
                  <v-list-item dense>
                    <v-list-item-content>
                      <div v-if="processing.dataset">
                        Jeu de données associé : <a :href="datasetUrl(processing.dataset.id)" target="_blank">{{ processing.dataset.title }}</a>
                        &nbsp;<v-chip :color="processing.dataset.status === 'error' ? 'error': 'success'" small>
                          {{ processing.dataset.status }}
                        </v-chip>
                      </div>
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item v-if="processing.owner" dense>
                    <v-list-item-content>
                      <div>
                        Propriétaire : {{ processing.owner.name }}
                      </div>
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item dense>
                    <v-list-item-content>
                      <div>
                        Type de traitement : <processing-infos :processing="processing" />
                      </div>
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item dense>
                    <v-list-item-content>
                      <div>
                        Périodicité : <span class="accent--text">{{ format(processing.scheduling) }}</span>
                      </div>
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item v-if="processing['last-execution']" dense>
                    <v-list-item-content>
                      <div>
                        Dernière exécution :
                        <span class="accent--text">{{ processing['last-execution'].date | moment('from') }}</span>
                        &nbsp;<v-chip :color="processing['last-execution'].status === 'ok' ? 'success' : 'error'" small>
                          {{ processing['last-execution'].status }}
                        </v-chip>
                      </div>
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item dense>
                    <v-list-item-content>
                      <span>
                        Actif : <v-icon :color="processing.active ? 'success' : 'error'">
                          mdi-circle
                        </v-icon>
                      </span>
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item dense>
                    <v-list-item-content>
                      <span>
                        Clé webhook : <code>{{ processing.webhookKey }}</code> <processing-key :processing="processing" />
                      </span>
                    </v-list-item-content>
                  </v-list-item>
                </v-list>
              </v-card-text>
              <v-divider />
              <v-card-actions class="py-0">
                <v-spacer />
                <v-btn
                  :disabled="processing.status === 'running'"
                  icon
                  color="primary"
                  text
                  @click="run(processing)"
                >
                  <v-icon>
                    mdi-play
                  </v-icon>
                </v-btn>
                <processing-schedule v-if="processing.scheduling && processing.scheduling.unit !== 'trigger'" :processing-id="processing.id" />
                <processing-logs :processing-id="processing.id" />
                <edit-processing :processing-id="processing.id" @updated="refresh" />
                <remove-processing :processing="processing" @removed="refresh" />

                <v-spacer />
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-col>
    <layout-navigation-right v-if="this.$vuetify.breakpoint.lgAndUp">
      <v-list dense class="list-actions">
        <v-menu
          v-model="showCreateMenu"
          :close-on-content-click="false"
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
                  :loading="!installedPlugins.results"
                  :items="installedPlugins.results"
                  item-title="name"
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
                @click="createPortal(); showCreateMenu = false"
              >
                Enregistrer
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-menu>
      </v-list>
    </layout-navigation-right>
  </v-row>
</template>

<script>
  import EditProcessing from '~/components/edit-processing.vue'
  import RemoveProcessing from '~/components/remove-processing.vue'
  import ProcessingInfos from '~/components/processing-infos.vue'
  import ProcessingLogs from '~/components/processing-logs.vue'
  import ProcessingSchedule from '~/components/processing-schedule.vue'
  import ProcessingKey from '~/components/processing-key.vue'
  import format from '~/assets/format.js'
  import eventBus from '~/event-bus'

  export default {
    components: {
      EditProcessing,
      RemoveProcessing,
      ProcessingInfos,
      ProcessingLogs,
      ProcessingSchedule,
      ProcessingKey,
    },
    middleware: 'superadmin-required',
    data: () => ({
      processings: null,
      installedPlugins: {},
    }),
    watch: {},
    created() {
      this.refresh()
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
