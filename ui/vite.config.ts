import path from 'node:path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Unfonts from 'unplugin-fonts/vite'
import Vuetify from 'vite-plugin-vuetify'
import microTemplate from '@data-fair/lib-utils/micro-template.js'
import { autoImports, settingsPath } from '@data-fair/lib-vuetify/vite.js'
import { commonjsDeps } from '@koumoul/vjsf/utils/build.js'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/processings',
  build: {
    rollupOptions: {
      output: {
        experimentalMinChunkSize: 2000
      }
    }
  },
  optimizeDeps: { include: ['debug', ...commonjsDeps] },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src/')
    },
  },
  plugins: [
    VueRouter({
      dts: './dts/typed-router.d.ts',
      exclude: process.env.NODE_ENV === 'development' ? [] : ['src/pages/dev.vue']
    }),
    Vue({ template: { compilerOptions: { isCustomElement: (tag) => ['d-frame'].includes(tag) } } }),
    VueI18nPlugin(),
    Vuetify({ styles: { configFile: settingsPath } }),
    Unfonts({ google: { families: [{ name: 'Nunito', styles: 'ital,wght@0,200..1000;1,200..1000' }] } }),
    AutoImport({
      dts: './dts/auto-imports.d.ts',
      vueTemplate: true,
      imports: [
        ...(autoImports as any),
        {
          '~/context': ['$uiConfig', '$sitePath', '$apiPath', '$fetch'],
          '@mdi/js': [
            'mdiAccount',
            'mdiAlert',
            'mdiAlertCircle',
            'mdiBell',
            'mdiCheckCircle',
            'mdiClock',
            'mdiCloud',
            'mdiContentDuplicate',
            'mdiDatabase',
            'mdiDotsVertical',
            'mdiDownload',
            'mdiInformation',
            'mdiMagnify',
            'mdiOpenInNew',
            'mdiPlay',
            'mdiPlayCircle',
            'mdiPlusCircle',
            'mdiPowerPlug',
            'mdiStop',
            'mdiToggleSwitch',
            'mdiToggleSwitchOff',
            'mdiUpdate',
            'mdiDelete'
          ]
        }
      ],
      dirs: [
        'src/utils',
        'src/composables'
      ]
    }),
    Components(),
    {
      name: 'inject-site-context',
      async transformIndexHtml (html) {
        // in production this injection will be performed by an express middleware
        if (process.env.NODE_ENV !== 'development') return html
        const { uiConfig } = await import('../api/src/config')
        return microTemplate(html, { SITE_PATH: '', UI_CONFIG: JSON.stringify(uiConfig) })
      }
    }
  ],
  experimental: {
    renderBuiltUrl (filename, { hostType }) {
      if (hostType === 'html') return '{SITE_PATH}/processings/' + filename
      return { relative: true }
    }
  },
  server: { hmr: { port: 7200 } }
})
