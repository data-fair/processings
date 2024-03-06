<template>
  <div
    class="sd-avatar"
    :class="{'has-secondary-avatar': showAccount && activeAccount.type !== 'user'}"
  >
    <v-avatar
      v-if="showAccount && activeAccount.type === 'user'"
      class="primary-avatar"
      :size="36"
    >
      <img
        :src="userAvatarUrl"
        aria-hidden
        alt=""
      >
    </v-avatar>
    <v-avatar
      v-else
      class="primary-avatar"
      :size="36"
    >
      <img
        :src="accountAvatarUrl"
        aria-hidden
        alt=""
      >
    </v-avatar>
    <v-avatar
      v-if="showAccount && activeAccount.type !== 'user'"
      class="secondary-avatar"
      :size="28"
    >
      <img
        :src="userAvatarUrl"
        aria-hidden
        alt=""
      >
    </v-avatar>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '~/store/index'

const { showAccount } = defineProps({
  showAccount: { type: Boolean, default: false }
})

const sessionStore = useStore()

const directoryUrl = computed(() => sessionStore.directoryUrl)
const user = computed(() => sessionStore.user)
const activeAccount = computed(() => sessionStore.activeAccount)

const userAvatarUrl = computed(() => {
  return `${directoryUrl.value}/api/avatars/user/${user.value.id}/avatar.png`
})

const accountAvatarUrl = computed(() => {
  let url = `${directoryUrl.value}/api/avatars/${activeAccount.value.type}/${activeAccount.value.id}`
  if (activeAccount.value.department) url += `/${activeAccount.value.department}`
  url += '/avatar.png'
  return url
})
</script>

<style>
.sd-avatar {
  width: 36px;
  text-indent: 0;
}
.sd-avatar.has-secondary-avatar {
  width: 56px;
  height: 40px;
  position: relative;
  margin-left: 8px;
  margin-right: 8px;
}
.sd-avatar.has-secondary-avatar .primary-avatar {
  position: absolute;
  left: 0;
  top: 0
}
.sd-avatar .secondary-avatar {
  position:absolute;
  right:0px;
  bottom:0;
}
</style>
