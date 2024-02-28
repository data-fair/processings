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
    'plugin:vue/essential',
    'plugin:vue/recommended',
    'plugin:vuetify/base',
    'standard'
  ],
  rules: {
    'space-before-function-paren': 'off',
    'node/no-deprecated-api': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-mutating-props': 'off',
    'vue/no-useless-template-attributes': 'off',
    'vue/no-v-for-template-key-on-child': 'off',
    'vue/no-v-html': 'off',
    'vue/require-prop-types': 'off'
  }
}
