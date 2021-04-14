<template>
  <v-card tile :loading="loading">
    <v-card-title>
      Exécutions
      <v-spacer />
      <v-btn icon @click="refresh">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </v-card-title>
    <v-list class="py-0">
      <template v-if="runs">
        <template v-for="run in runs.results">
          <v-divider :key="run._id + '-divider'" />
          <run-list-item
            :key="run._id + '-item'"
            :run="run"
            :link="true"
          />
        </template>
      </template>
    </v-list>
  </v-card>
</template>

<script>
  export default {
    props: ['processing'],
    data() {
      return { loading: false, runs: null }
    },
    async mounted() {
      await this.refresh()
    },
    methods: {
      async refresh() {
        this.loading = true
        this.runs = await this.$axios.$get('api/v1/runs', { params: { processing: this.processing._id, size: 1000, sort: 'createdAt:-1' } })
        this.loading = false
      },
    },
  }
</script>

<style lang="css" scoped>
</style>
