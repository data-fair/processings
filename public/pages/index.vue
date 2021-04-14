<template lang="html">
  <p>
    Data Fair - Traitements périodiques
  </p>
</template>

<script>
  export default {
    mounted() {
      this.$store.dispatch('setBreadcrumbs', [])
    },
  }
</script>

<style lang="css" scoped>
</style>
