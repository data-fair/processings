<template>
  <div>
    <edit-processing @created="refresh" />
    <v-container grid-list-xl>
      <v-subheader>{{ (processings && processings.count) || 0 }} traitements</v-subheader>
      <v-layout v-if="processings" wrap>
        <v-flex v-for="processing in processings.results" :key="processing.id" md4 sm6 xs12>
          <v-card :elevation="4" class="fill-height" style="display:flex;flex-direction:column;">
            <v-card-title class="title px-1">
              <v-flex text-center pa-0>
                {{ processing.title | truncate(32) }}
              </v-flex>
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
                      Périodicité : <span class="accent--text">Toutes les {{ processing.scheduling.interval }} {{ processing.scheduling.unit }}</span>
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
              </v-list>
            </v-card-text>
            <v-divider />
            <v-card-actions class="py-0">
              <v-spacer />
              <v-btn :disabled="processing.status === 'running'" icon color="primary" text @click="run(processing)">
                <v-icon>
                  mdi-play
                </v-icon>
              </v-btn>
              <processing-schedule :processing-id="processing.id" />
              <processing-logs :processing-id="processing.id" />
              <edit-processing :processing-id="processing.id" @updated="refresh" />
              <remove-processing :processing="processing" @removed="refresh" />

              <v-spacer />
            </v-card-actions>
          </v-card>
        </v-flex>
      </v-layout>
    </v-container>
  </div>
</template>

<script>
import EditProcessing from '~/components/edit-processing.vue'
import RemoveProcessing from '~/components/remove-processing.vue'
import ProcessingInfos from '~/components/processing-infos.vue'
import ProcessingLogs from '~/components/processing-logs.vue'
import ProcessingSchedule from '~/components/processing-schedule.vue'
import eventBus from '../event-bus'

export default {
  middleware: 'superadmin-required',
  components: {
    EditProcessing,
    RemoveProcessing,
    ProcessingInfos,
    ProcessingLogs,
    ProcessingSchedule
  },
  data: () => ({
    processings: null
  }),
  watch: {},
  created() {
    this.refresh()
  },
  methods: {
    datasetUrl(datasetId) {
      return process.env.datasetsUrlTemplate.replace('{id}', datasetId)
    },
    async refresh() {
      try {
        this.processings = await this.$axios.$get(process.env.publicUrl + '/api/v1/processings')
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
    }
  }
}
</script>
