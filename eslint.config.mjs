import neostandard from 'neostandard'
import dfLibRecommended from '@data-fair/lib-utils/eslint/recommended.js'

export default [
  { ignores: ['ui/', '**/.type/', 'data/'] },
  ...dfLibRecommended,
  ...neostandard({ ts: true }),
  {
    // server code logs through @data-fair/lib-node/log.js; the task child process keeps console:
    // the parent reads its stdout (<running>) and shows its stderr to the user
    files: ['api/src/**/*.ts', 'api/index.ts', 'worker/src/**/*.ts', 'worker/index.ts', 'shared/**/*.ts'],
    ignores: ['worker/src/task/index.ts', 'worker/src/task/task.ts'],
    rules: { 'no-console': 'error' }
  }
]
