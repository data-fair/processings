<template>
  <div>
    <edit-processing @created="refresh" />
    <v-container grid-list-xl>
      <v-subheader>{{ (processings && processings.count) || 0 }} traitements</v-subheader>
      <v-layout v-if="processings" wrap>
        <v-flex
          v-for="processing in processings.results" :key="processing.id" md4 sm6 xs12
        >
          <v-card :elevation="4">
            <v-card-title class="title">
              <v-flex
                text-center
                pa-0
              >
                {{ processing.title }}
              </v-flex>
            </v-card-title>
            <v-divider />

            <v-card-text class="px-0 pt-0">
              <v-list>
                <v-list-item dense>
                  <v-list-item-content>
                    <div>
                      Jeu de données associé : <a :href="datasetsUrl + processing.dataset.id + '/tabular'" target="_blank">{{ processing.dataset.title }}</a>
                      &nbsp;<v-chip :color="processing.dataset.status === 'error' ? 'error': 'success'" small>
                        {{ processing.dataset.status }}
                      </v-chip>
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
                      Périodicité : <span class="accent--text">Toutes les {{ processing.periodicity.value }} {{ processing.periodicity.unit }}</span>
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
                    <div>
                      Statut : <span class="accent--text">{{ processing.status }}</span>
                    </div>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-divider />
            <v-card-actions class="py-0">
              <v-spacer />
              <v-btn
                icon color="primary" text @click="toggle(processing)"
              >
                <v-icon v-if="processing.status === 'stopped'">
                  mdi-play
                </v-icon>
                <v-icon v-else>
                  mdi-stop
                </v-icon>
              </v-btn>
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
import eventBus from '../event-bus'

export default {
  middleware: 'superadmin-required',
  components: {
    EditProcessing,
    RemoveProcessing,
    ProcessingInfos,
    ProcessingLogs
  },
  data: () => ({
    processings: null
  }),
  computed: {
    datasetsUrl() {
      return process.env.dataFairUrl + '/dataset/'
    }
  },
  watch: {},
  created() {
    this.refresh()
  },
  methods: {
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
    async toggle(processing) {
      try {
        const status = (processing.status === 'running') ? 'stopped' : 'running'
        await this.$axios.$patch(process.env.publicUrl + '/api/v1/processings/' + processing.id, { status })
        processing.status = status
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant le changement de statut du traitement' })
      }
    }
  }
}
</script>
