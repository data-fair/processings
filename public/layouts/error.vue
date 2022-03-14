<template>
  <div class="container">
    <v-alert
      v-if="error.statusCode !== 401"
      type="error"
    >
      {{ error.message }}
    </v-alert>
  </div>
</template>

<script>
export default {
  layout: 'empty',
  props: ['error'],
  mounted () {
    if (this.error.statusCode === 401) this.$store.dispatch('session/login')
  }
}
</script>
