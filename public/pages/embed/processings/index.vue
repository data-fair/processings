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
      <section-subtitle :text="`${processings.count} demandes d'assistance`" />
      <v-layout wrap>
        <v-flex v-for="processing in processings.results" :key="processing.id" md4 sm6 xs12>
          <nuxt-link
            :to="{name: 'embed-processings-id', params:{id: processing.id}}"
            style="text-decoration:none"
          >
            <v-hover>
              <v-card slot-scope="{ hover }" :class="`elevation-${hover ? 16 : 2}`" style="cursor:pointer;height:100%;">
                <v-card-title>
                  <card-title :text="processing.title | truncate(32)" />
                  <v-spacer />
                  <!-- <v-chip v-if="processing.criticity === 'low'" class="success">
                      {{ categoryLabel[processing.category] }}
                    </v-chip>
                    <v-chip v-if="processing.criticity === 'medium'" class="warning">
                      {{ categoryLabel[processing.category] }}
                    </v-chip>
                    <v-chip v-if="processing.criticity === 'high'" class="error">
                      {{ categoryLabel[processing.category] }}
                    </v-chip> -->
                </v-card-title>
                <v-card-text style="height:110px;overflow:hidden;">
                  {{ processing.description }}
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

export default {
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
    },
    entity() {
      this.$scrollTo()
    }
  },
  mounted() {
    this.refresh()
  },
  methods: {
    async refresh() {
      try {
        // this.processings = await this.$axios.$get(`${process.env.publicUrl}/api/v1/processings/${this.activeAccount.type}/${this.activeAccount.id}`)
      } catch (err) {
        console.log(err)
      }
    }
  }
}
</script>

<style lang="css" scoped>
</style>
