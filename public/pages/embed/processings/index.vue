<template lang="html">
  <v-container class="fill-height" grid-list-xl>
    <v-layout v-if="!processings || !processings.count" align-center>
      <v-flex text-center xs12 sm10 offset-sm1 md8 offset-md2 lg6 offset-lg3>
        <v-alert :value="true" type="info" outlined>
          <h4 class="subheading font-weight-bold blue-grey--text text--darken-3">
            Aucune traitement périodique n'est paramétré pour votre compte
          </h4>
        </v-alert>
      </v-flex>
    </v-layout>
    <v-col v-else class="fill-height">
      <h3 class="'title grey--text text--darken-3 my-3'">
        {{ processings.count }} traitement(s)
      </h3>
      <v-layout wrap>
        <v-flex v-for="processing in processings.results" :key="processing.id" md4 sm6 xs12>
          <nuxt-link
            :to="{name: 'embed-processings-id', params:{id: processing.id}}"
            style="text-decoration:none"
          >
            <v-hover>
              <v-card slot-scope="{ hover }" :class="`elevation-${hover ? 16 : 2}`" style="cursor:pointer;height:100%;">
                <v-card-title class="title">
                  <v-flex text-center pa-0>
                    {{ processing.title }}
                  </v-flex>
                </v-card-title>
                <v-card-text>
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
            </v-hover>
          </nuxt-link>
        </v-flex>
      </v-layout>
    </v-col>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex'
import ProcessingInfos from '~/components/processing-infos.vue'

export default {
  components: { ProcessingInfos },
  layout: 'embed',
  middleware: 'admin-required',
  data: () => ({
    processings: null
  }),
  computed: {
    ...mapGetters(['activeAccount'])
  },
  watch: {
    'activeAccount.key'(newV, oldV) {
      if (newV !== oldV) {
        this.refresh()
      }
    }
  },
  mounted() {
    this.refresh()
  },
  methods: {
    datasetUrl(datasetId) {
      return process.env.publicDatasetsUrlTemplate.replace('{id}', datasetId)
    },
    async refresh() {
      try {
        this.processings = await this.$axios.$get(`${process.env.publicUrl}/api/v1/processings/${this.activeAccount.type}/${this.activeAccount.id}`)
      } catch (err) {
        console.log(err)
      }
    }
  }
}
</script>

<style lang="css" scoped>
</style>
