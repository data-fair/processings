module.exports = {
  env: {
    browser: true
  },
  extends: [
    'standard',
    '@nuxt/eslint-config',
    'plugin:vuetify/base'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser'
  },
  rules: {
    'space-before-function-paren': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-mutating-props': 'off'
  }
}
