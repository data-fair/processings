import Cookies from 'js-cookie'
import { defineNuxtPlugin } from 'nuxt/app'
import { ofetch } from 'ofetch'
import { useRoute } from 'vue-router'
import { useCookie } from '#app'
import { useStore } from '~/store/index'

export default defineNuxtPlugin(nuxtApp => {
  const route = useRoute()
  const themeCookie = useCookie('theme_dark')
  const store = useStore()
  const runtimeConfig = useRuntimeConfig()

  nuxtApp.hook('app:mounted', () => {
    let publicUrl = window.location.origin + runtimeConfig.public.basePath
    if (publicUrl.endsWith('/')) publicUrl = publicUrl.slice(0, -1)
    const currentHost = new URL(publicUrl).host

    const dataFairUrl = new URL(runtimeConfig.public.dataFairUrl)
    dataFairUrl.host = currentHost
    const notifyUrl = new URL(runtimeConfig.public.notifyUrl)
    notifyUrl.host = currentHost
    const directoryUrl = new URL(runtimeConfig.public.directoryUrl)
    directoryUrl.host = currentHost

    store.setAny({
      env: {
        ...runtimeConfig.public,
        publicUrl,
        secondaryHost: currentHost !== new URL(runtimeConfig.public.mainPublicUrl).host,
        dataFairUrl: dataFairUrl.href,
        notifyUrl: notifyUrl.href,
        directoryUrl: directoryUrl.href,
      },
      vuetify: nuxtApp.$vuetify,
    })

    store.init({
      cookies: Cookies,
      directoryUrl: directoryUrl.href,
      httpLib: ofetch,
    })

    if (!store.embed) {
      store.loop(Cookies)
    }

    if (themeCookie.value !== undefined) {
      nuxtApp.vueApp.provide('theme', themeCookie.value === 'true' ? 'dark' : 'light')
    }

    if (route.query.dark) {
      nuxtApp.vueApp.provide('theme', route.query.dark === 'true' ? 'dark' : 'light')
    }
  })
})
