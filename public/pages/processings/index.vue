<template lang="html">
  <v-container class="fill-height">
    <v-row v-if="!processings || !processings.count" align="center">
      <v-col
        class="text-center"
        cols="12"
        sm="10"
        offset-sm="1"
        md="8"
        offset-md="2"
        lg="6"
        offset-lg="3"
      >
        <v-alert
          :value="true"
          type="info"
          outlined
        >
          <h4 class="subheading font-weight-bold blue-grey--text text--darken-3">
            Aucun traitement périodique n'est paramétré pour votre compte
          </h4>
        </v-alert>
      </v-col>
    </v-row>
    <v-col v-else class="fill-height">
      <h3 class="'title grey--text text--darken-3 my-3'">
        {{ processings.count }} traitement(s)
      </h3>
      <v-row>
        <v-col
          v-for="processing in processings.results"
          :key="processing.id"
          md="4"
          sm="6"
          cols="12"
        >
          <nuxt-link
            :to="{name: 'embed-processings-id', params:{id: processing.id}}"
            style="text-decoration:none"
          >
            <v-hover>
              <v-card
                slot-scope="{ hover }"
                :class="`elevation-${hover ? 16 : 2}`"
                class="fill-height"
                style="cursor:pointer;height:100%;display:flex;flex-direction:column;"
              >
                <v-card-title class="text-h6 px-1">
                  <v-col class="text-center pa-0">
                    {{ processing.title | truncate(30) }}
                  </v-col>
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
                          <span class="grey--text text--darken-2">Type de traitement :</span> <processing-infos :processing="processing" />
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
        </v-col>
      </v-row>
    </v-col>
  </v-container>
</template>

<script>
  import { mapGetters } from 'vuex'
  import ProcessingInfos from '~/components/processing-infos.vue'
  import format from '~/assets/format.js'

  export default {
    components: { ProcessingInfos },
    middleware: 'admin-required',
    data: () => ({
      processings: null,
    }),
    computed: {
      ...mapGetters('session', ['activeAccount']),
    },
    watch: {
      'activeAccount.key'(newV, oldV) {
        if (newV !== oldV) {
          this.refresh()
        }
      },
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
      format,
    },
  }
</script>

<style lang="css" scoped>
</style>
