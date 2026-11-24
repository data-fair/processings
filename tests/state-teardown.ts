import { test as teardown } from '@playwright/test'
import { releaseStatefulLock } from './support/stateful-lock.ts'

teardown('Stateful tests teardown', () => {
  // A lock left behind would be taken over anyway once this run's process is gone; releasing it here
  // just spares the next run that check.
  releaseStatefulLock()
})
