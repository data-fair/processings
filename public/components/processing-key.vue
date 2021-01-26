<template lang="html">
  <v-menu v-if="processing" v-model="menu" :max-width="1000" :close-on-content-click="false">
    <template v-slot:activator="{ on: menu, attrs }">
      <v-tooltip bottom>
        <template v-slot:activator="{ on: tooltip }">
          <v-btn
            text
            v-bind="attrs"
            v-on="{ ...tooltip, ...menu }"
          >
            <v-icon color="primary" small>
              mdi-help
            </v-icon>
          </v-btn>
        </template>
        <span>Déclenchement par webhook</span>
      </v-tooltip>
    </template>
    <v-card>
      <v-card-title>
        Vous pouvez déclencher une éxécution du traitement avec l'appel suivant :
      </v-card-title>
      <v-card-text>
        <code style="width:100%">
          {{ curl }}
        </code>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script>
export default {
  props: {
    processing: { type: Object, required: true }
  },
  data() {
    return {
      menu: null
    }
  },
  computed: {
    curl () {
      return `curl -X POST ${process.env.publicUrl}/api/v1/processings/${this.processing.id}/_run -H 'x-apikey: ${this.processing.webhookKey}'`
    }
  }
}
</script>
