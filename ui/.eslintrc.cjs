module.exports = {
  root: true,
  env: {
    node: true
  },
  plugins: [
    'no-only-tests'
  ],
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:vuetify/base',
    'standard'
  ],
  rules: {
    'space-before-function-paren': 'off',
    'node/no-deprecated-api': 'off',
    'vue/multi-word-component-names': 'off'
  }
}
