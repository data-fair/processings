<template lang="html">
  <v-tooltip v-if="processingId" top>
    <template v-slot:activator="{ on }">
      <v-btn text v-on="on" @click="stepper=0;dialog=true">
        <v-icon color="primary">
          mdi-text-subject
        </v-icon>
      </v-btn>
    </template>
    <span>Journal du traitement</span>
    <v-dialog v-model="dialog" :fullscreen="$vuetify.breakpoint.mdAndDown" :max-width="1200">
      <v-card class="py-3">
        <v-simple-table dense>
          <template v-slot:default>
            <thead>
              <tr>
                <th>
                  Date
                </th>
                <th>
                  Message
                </th>
                <th c>
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.date">
                <td>{{ log.date | moment('Do MMM YYYY - HH:mm:ss') }}</td>
                <td>{{ log.message }}</td>
                <td>{{ log.status }}</td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </v-card>
    </v-dialog>
  </v-tooltip>
</template>

<script>
import eventBus from '../event-bus'

export default {
  props: {
    processingId: { type: String, required: true }
  },
  data() {
    return {
      dialog: null,
      logs: []
    }
  },
  watch: {
    dialog(val) {
      if (val) this.refresh()
    }
  },
  async mounted() {
    // this.vocabulary = await this.$axios.$get(process.env.publicUrl + '/data-fair/api/v1/vocabulary')
  },
  methods: {
    async refresh() {
      try {
        this.logs = await this.$axios.$get(process.env.publicUrl + '/api/v1/processings/' + this.processingId + '/logs')
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la récupération du journal du traitement' })
        this.dialog = false
      }
    }
  }
}
</script>
