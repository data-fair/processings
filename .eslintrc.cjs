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
    'standard',
    'typescript'
  ],
  parser: '@typescript-eslint/parser'
}
