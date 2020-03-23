<template lang="html">
  <div>
    <v-layout v-if="processing" column style="position:fixed;right:2px;z-index:10">
      <!-- <view-resource :resource="issue" :fab="true" type="issues" />
      <clone-resource :resource="issue" :fab="true" type="issues" @created="$router.push({name: 'issues-id-edit', params:{id: $event.id}})"/>
      <remove-resource :resource="issue" :fab="true" type="issues" @removed="$router.push({name: 'issues'})"/> -->
    </v-layout>
    <v-container v-if="processing" grid-list-xl fluid>
      <nuxt-link :to="{name: 'embed-processings'}">
        Retour à la liste des traitements
      </nuxt-link>
      <v-layout wrap>
        <v-flex xs12 sm6 md4 lg3>
          <v-card>
            <v-card-title class="title">
              <v-flex text-center pa-0>
                {{ processing.title }}
              </v-flex>
            </v-card-title>
            <v-card-text>
              <v-list dense>
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
                      Actif : <span class="accent--text">{{ processing.active ? 'oui' : 'non' }}</span>
                    </div>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-divider />
            <v-card-text class="px-5">
              <v-row align="center">
                <v-icon size="18">
                  mdi-plus-circle-outline
                </v-icon>&nbsp;{{ processing.created.date | moment('from') }}
                &nbsp;<v-icon size="18">
                  mdi-update
                </v-icon>&nbsp;{{ processing.updated.date | moment('from') }}
              </v-row>
            </v-card-text>
          </v-card>
        </v-flex>
      </v-layout>
    </v-container>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ProcessingInfos from '~/components/processing-infos.vue'

export default {
  components: { ProcessingInfos },
  layout: 'embed',
  middleware: 'admin-required',
  data: () => ({
    processing: null
  }),
  computed: {
    ...mapState('session', ['user'])
  },
  async mounted() {
    this.refresh()
  },
  methods: {
    datasetUrl(datasetId) {
      return process.env.publicDatasetsUrlTemplate.replace('{id}', datasetId)
    },
    async refresh() {
      this.processing = await this.$axios.$get(process.env.publicUrl + '/api/v1/processings/' + this.$route.params.id)
    }
  }
}
</script>
