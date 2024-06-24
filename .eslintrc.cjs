module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: [
    'standard',
    'plugin:jsdoc/recommended-typescript-flavor-error'
  ],
  plugins: ['jsdoc', 'no-only-tests'],
  rules: {
    'no-only-tests/no-only-tests': 'error',
    'jsdoc/require-param-description': 0,
    'jsdoc/require-property-description': 0,
    'jsdoc/require-jsdoc': 0,
    'jsdoc/require-returns': 0,
    'jsdoc/require-returns-description': 0
  }
}
