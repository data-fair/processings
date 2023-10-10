<template>
  <v-container
    data-iframe-height
    style="min-height:500px;"
  >
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
              <processing-card
                :processing="processing"
                :show-owner="showAll"
                :plugin="installedPlugins.results && installedPlugins.results.find(p => p.id === processing.plugin)"
              />
            </v-col>
          </v-row>
        </v-container>
      </v-col>
      <layout-navigation-right v-if="$vuetify.breakpoint.lgAndUp">
        <processings-actions :installed-plugins="installedPlugins" />
        <v-card
          v-if="user.adminMode"
          color="admin"
          dark
          flat
          class="mt-2"
        >
          <v-card-text class="pa-1">
            <v-switch
              v-model="showAll"
              label="voir tous les traitements"
              hide-details
              dense
              class="mt-0"
              @change="refresh"
            />
          </v-card-text>
        </v-card>
      </layout-navigation-right>
      <layout-actions-button
        v-else
        class="pt-2"
      >
        <template #actions>
          <processings-actions
            v-if="ownerRole === 'admin' || user.adminMode"
            :installed-plugins="installedPlugins"
          />
        </template>
      </layout-actions-button>
    </v-row>
  </v-container>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import format from '~/assets/format.js'
import eventBus from '~/event-bus'

export default {
  components: {},
  middleware: 'contrib-required',
  data: () => ({
    processings: null,
    installedPlugins: {},
    showAll: false
  }),
  computed: {
    ...mapState('session', ['user']),
    ...mapGetters('session', ['activeAccount']),
    owner () {
      if (this.$route.query.owner) {
        const parts = this.$route.query.owner.split(':')
        return { type: parts[0], id: parts[1] }
      } else {
        return this.activeAccount
      }
    },
    ownerRole () {
      if (this.owner.type === 'user') {
        if (this.owner.id === this.user.id) return 'admin'
        else return 'anonymous'
      }
      const userOrg = this.user.organizations.find(o => o.id === this.owner.id)
      return userOrg ? userOrg.role : 'anonymous'
    },
    ownerFilter () {
      return `${this.owner.type}:${this.owner.id}`
    }
  },
  watch: {},
  created () {
    this.$store.dispatch('setBreadcrumbs', [{
      text: 'traitements'
    }])
    this.refresh()
    this.fetchInstalledPlugins()
  },
  methods: {
    async fetchInstalledPlugins () {
      this.installedPlugins = await this.$axios.$get('/api/v1/plugins', {
        params: {
          privateAccess: this.ownerFilter
        }
      })
    },
    async refresh () {
      try {
        const params = {
          size: 10000,
          showAll: this.showAll,
          sort: 'updated.date:-1',
          select: '_id,title,plugin,lastRun,nextRun,owner'
        }
        if (this.showAll) {
          params.showAll = true
        } else {
          params.owner = this.ownerFilter
        }
        this.processings = await this.$axios.$get('api/v1/processings', { params })
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la récupération de la liste des traitements' })
      }
    },
    format
  }
}
</script>
