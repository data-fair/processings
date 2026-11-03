import path from 'node:path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueRouter from 'vue-router/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Vuetify from 'vite-plugin-vuetify'
import microTemplate from '@data-fair/lib-utils/micro-template.js'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import { autoImports, settingsPath } from '@data-fair/lib-vuetify/vite.js'
import { commonjsDeps } from '@koumoul/vjsf/utils/build.js'

// dev ports come from .env (declared in dev/dev.json), checked so a missing variable never becomes NaN
const envPort = (name: string) => {
  const port = Number(process.env[name])
  if (!Number.isInteger(port) || port <= 0) throw new Error(`${name} must be set to a port number, run "npx --no df-dev init-env"`)
  return port
}

// https://vitejs.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  base: '/processings',
  optimizeDeps: {
    // no discovery: a dependency found while browsing reloads the page, which breaks cold e2e runs;
    // ESM dependencies are served as is, only the commonjs ones must be listed here, with the
    // exact import specifier
    noDiscovery: true,
    include: [
      'cronstrue',
      'cronstrue/locales/en',
      'cronstrue/locales/fr',
      'dayjs',
      'timezones.json',
      'ajv-i18n/localize/en/index.js',
      'ajv-i18n/localize/fr/index.js',
      ...commonjsDeps
    ]
  },
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'src/')
    },
  },
  html: {
    cspNonce: '{CSP_NONCE}'
  },
  plugins: [
    VueRouter({
      dts: './dts/typed-router.d.ts',
      // by the vite command, not NODE_ENV that a build can inherit by mistake
      exclude: command === 'build' ? ['src/pages/dev.vue', 'src/pages/dev/**'] : []
    }),
    Vue({ template: { compilerOptions: { isCustomElement: (tag) => ['d-frame'].includes(tag) } } }),
    VueI18nPlugin(),
    Vuetify({ styles: { configFile: settingsPath } }),
    AutoImport({
      dts: './dts/auto-imports.d.ts',
      vueTemplate: true,
      imports: [
        ...autoImports,
        VueRouterAutoImports,
        {
          '~/context': ['$uiConfig', '$sitePath', '$cspNonce', '$apiPath', '$fetch'],
          '@mdi/js': [
            'mdiAccount',
            'mdiAlert',
            'mdiAlertCircle',
            'mdiBell',
            'mdiBookOpenVariant',
            'mdiCancel',
            'mdiCheckCircle',
            'mdiChevronUp',
            'mdiChevronDown',
            'mdiClock',
            'mdiCloud',
            'mdiContentCopy',
            'mdiContentSave',
            'mdiContentDuplicate',
            'mdiDatabase',
            'mdiDotsVertical',
            'mdiDownload',
            'mdiInformation',
            'mdiMagnify',
            'mdiOpenInNew',
            'mdiPencil',
            'mdiPlay',
            'mdiPlayCircle',
            'mdiPlusCircle',
            'mdiPlusCircleOutline',
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
    Components({ dts: './dts/components.d.ts' }),
    {
      name: 'inject-site-context',
      async transformIndexHtml (html) {
        // in production this injection will be performed by an express middleware
        if (process.env.NODE_ENV !== 'development') return html
        const { uiConfigPath } = (await import('@data-fair/lib-express')).prepareUiConfig((await import('../api/src/config.ts')).uiConfig)
        return microTemplate(html, { SITE_PATH: '', UI_CONFIG_PATH: uiConfigPath, THEME_CSS_HASH: '', PUBLIC_SITE_INFO_HASH: '' })
      }
    }
  ],
  experimental: {
    renderBuiltUrl (filename, { hostType }) {
      if (hostType === 'html') return '{SITE_PATH}/processings/' + filename
      return { relative: true }
    }
  },
  // vite preview runs with command 'serve' too, it needs no dev port
  server: command === 'serve' && !isPreview
    ? { port: envPort('DEV_UI_PORT'), strictPort: true, hmr: { port: envPort('DEV_UI_HMR_PORT') } }
    : undefined
}))
