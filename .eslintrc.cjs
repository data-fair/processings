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
    'standard'
  ],
  rules: {
    'node/no-deprecated-api': 'off'
  }
}
