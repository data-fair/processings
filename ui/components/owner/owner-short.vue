<template>
  <v-tooltip top>
    <template #activator="{on}">
      <span
        class="text-body-2"
        v-on="on"
      >
        <v-avatar :size="28">
          <img :src="`${env.directoryUrl}/api/avatars/${owner.type}/${owner.id}/avatar.png`">
        </v-avatar>
      </span>
    </template>
    {{ label }}
  </v-tooltip>
</template>

<script>

import { mapState } from 'vuex'

export default {
  props: ['owner'],
  computed: {
    ...mapState(['env']),
    label () {
      let label = this.owner.name
      if (this.owner.role) label += ` (${this.owner.role})`
      return label
    }
  }
}
</script>

<style lang="css" scoped>
</style>
