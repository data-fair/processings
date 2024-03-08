<template>
  <v-snackbar
    v-if="notification"
    ref="notificationSnackbar"
    v-model="showSnackbar"
    :color="notification.type"
    :timeout="notification.type === 'error' ? 0 : 300000"
    class="notification"
    location="right bottom"
    :variant="$vuetify.theme.global.name === 'dark' ? 'outlined' : 'elevated'"
  >
    <p v-text="notification.msg" />
    <p
      v-if="notification.errorMsg"
      class="ml-3"
      v-text="notification.errorMsg"
    />
    <template #action>
      <v-btn
        icon
        @click="showSnackbar = false"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup>
import useEventBus from '~/composables/event-bus'
import { onMounted, ref } from 'vue'

const notification = ref(null)
const showSnackbar = ref(false)
const eventBus = useEventBus()

onMounted(() => {
  eventBus.on('notification', async (notif) => {
    if (showSnackbar.value) {
      showSnackbar.value = false
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    if (typeof notif === 'string') notif = { msg: notif }
    if (notif.error) {
      notif.type = 'error'
      notif.errorMsg = notif.error.response?.data || notif.error.response?.status || notif.error.message || notif.error
    }
    notif.type = notif.type || 'default'
    notification.value = notif
    showSnackbar.value = true
  })
})
</script>

<style>
.notification .v-snack__content {
  height: auto;
}

.notification .v-snack__content p {
  margin-bottom: 4px;
  margin-top: 4px;
}
</style>
