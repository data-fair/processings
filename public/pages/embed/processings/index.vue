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
              <v-card slot-scope="{ hover }" :class="`elevation-${hover ? 16 : 2}`" class="fill-height" style="cursor:pointer;height:100%;display:flex;flex-direction:column;">
                <v-card-title class="title px-1">
                  <v-flex text-center pa-0>
                    {{ processing.title | truncate(30) }}
                  </v-flex>
                </v-card-title>
                <v-divider />
                <v-card-text style="flex: 1;" class="py-0">
                  <v-list>
                    <!-- <v-list-item dense>
                      <v-list-item-content>
                        <div v-if="processing.dataset">
                          Jeu de données associé : <a :href="datasetUrl(processing.dataset.id)" target="_blank">{{ processing.dataset.title }}</a>
                        </div>
                      </v-list-item-content>
                    </v-list-item> -->
                    <v-list-item dense>
                      <v-list-item-content>
                        <div>
                          <span class="grey--text text--darken-2">Type de traitement :</span> <processing-infos :processing="processing" :no-modal="true" />
                        </div>
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item dense>
                      <v-list-item-content>
                        <div>
                          <span class="grey--text text--darken-2">Périodicité :</span> <span>{{ format (processing.scheduling) }}</span>
                        </div>
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item dense>
                      <v-list-item-content>
                        <div>
                          <span class="grey--text text--darken-2">Exécuté :</span>
                          <span v-if="processing['last-execution']">
                            <span>{{ processing['last-execution'].date | moment('from') }}</span>
                            &nbsp;<v-chip :color="processing['last-execution'].status === 'ok' ? 'success' : 'error'" small>
                              {{ processing['last-execution'].status }}
                            </v-chip>
                          </span><span v-else>jamais</span>
                        </div>
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item dense>
                      <v-list-item-content>
                        <span>
                          <span class="grey--text text--darken-2">Actif :</span> <v-icon :color="processing.active ? 'success' : 'error'">
                            mdi-circle
                          </v-icon>
                        </span>
                      </v-list-item-content>
                    </v-list-item>
                  </v-list>
                </v-card-text>
                <v-divider />
                <v-card-text class="px-5 py-0">
                  <v-row>
                    <v-col>
                      <v-icon size="18">
                        mdi-plus-circle-outline
                      </v-icon>&nbsp;{{ processing.created.date | moment('from') }}
                    </v-col>
                    <v-col>
                      <v-icon size="18">
                        mdi-update
                      </v-icon>&nbsp;{{ processing.updated.date | moment('from') }}
                    </v-col>
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
import format from '~/assets/format.js'

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
    async refresh() {
      try {
        this.processings = await this.$axios.$get(`${process.env.publicUrl}/api/v1/processings/${this.activeAccount.type}/${this.activeAccount.id}`)
      } catch (err) {
        console.log(err)
      }
    },
    format
  }
}
</script>

<style lang="css" scoped>
</style>
