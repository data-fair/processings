import Cookies from 'js-cookie'
import { defineNuxtPlugin } from '#app'
import { ofetch } from 'ofetch'
import { useStore } from '~/store/index'

export default defineNuxtPlugin(nuxtApp => {
  const store = useStore()
  const runtimeConfig = useRuntimeConfig()

  nuxtApp.hook('app:mounted', () => {
    let publicUrl = window.location.origin + runtimeConfig.public.basePath
    if (publicUrl.endsWith('/')) publicUrl = publicUrl.slice(0, -1)
    const currentHost = new URL(publicUrl).host

    const dataFairUrl = new URL(runtimeConfig.public.dataFairUrl)
    dataFairUrl.host = currentHost
    let notifyUrl
    if (runtimeConfig.public.notifyUrl !== null && runtimeConfig.public.notifyUrl !== '') {
      notifyUrl = new URL(runtimeConfig.public.notifyUrl)
      notifyUrl.host = currentHost
    } else {
      notifyUrl = {
        href: null
      }
    }
    const directoryUrl = new URL(runtimeConfig.public.directoryUrl)
    directoryUrl.host = currentHost

    store.init({
      cookies: Cookies,
      directoryUrl: directoryUrl.href,
      httpLib: ofetch
    })

    store.setAny({
      env: {
        ...runtimeConfig.public,
        publicUrl,
        secondaryHost: currentHost !== new URL(runtimeConfig.public.mainPublicUrl).host,
        dataFairUrl: dataFairUrl.href,
        notifyUrl: notifyUrl.href,
        directoryUrl: directoryUrl.href
      }
    })

    if (!store.embed) {
      store.loop(Cookies)
    }

    nuxtApp.vueApp.provide('store', store)
    nuxtApp.provide('store', store)
  })
})
