<template>
  <v-list dense class="list-actions">
    <v-list-item :disabled="!processing.active || !user.adminMode" @click="run()">
      <v-list-item-icon>
        <v-icon color="primary">
          mdi-play
        </v-icon>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>Exécuter</v-list-item-title>
      </v-list-item-content>
    </v-list-item>

    <v-menu
      v-model="showDeleteMenu"
      :close-on-content-click="false"
      max-width="500"
    >
      <template #activator="{on, attrs}">
        <v-list-item
          :disabled="!user.adminMode"
          v-bind="attrs"
          v-on="on"
        >
          <v-list-item-icon>
            <v-icon color="warning">
              mdi-delete
            </v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>Supprimer</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </template>
      <v-card outlined>
        <v-card-title primary-title>
          Suppression du traitement
        </v-card-title>
        <v-card-text>
          Voulez vous vraiment supprimer le traitement "{{ processing.title }}" et tout son historique ? La suppression est définitive et les données ne pourront pas être récupérées.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showDeleteMenu = false">
            Non
          </v-btn>
          <v-btn
            color="warning"
            @click="confirmRemove"
          >
            Oui
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-list-item
      v-if="processing.config && processing.config.dataset && processing.config.dataset.id"
      :href="`${dataFairUrl}/dataset/${processing.config.dataset.id}`"
      target="_blank"
    >
      <v-list-item-icon>
        <v-icon color="primary">
          mdi-open-in-new
        </v-icon>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>Voir le jeu de données</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script>
  import { mapState } from 'vuex'
  export default {
    props: ['processing'],
    data: () => ({
      showDeleteMenu: false,
    }),
    computed: {
      ...mapState('session', ['user']),
      dataFairUrl() {
        return process.env.dataFairUrl
      },
    },
    methods: {
      async confirmRemove() {
        this.showDeleteMenu = false
        await this.$axios.$delete(`api/v1/processings/${this.processing._id}`)
        this.$router.push('/processings')
      },
      async run() {
        await this.$axios.$post(`api/v1/processings/${this.processing._id}/_trigger`)
        this.$emit('triggered')
      },
    },
  }
</script>

<style lang="css" scoped>
</style>
