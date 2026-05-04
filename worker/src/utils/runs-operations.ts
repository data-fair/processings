// Pure helpers extracted from runs.ts. Stateless: no DB, no IO.

/**
 * Decide whether a processing should be disabled because it has failed too often.
 *
 * @param errors number of error runs among the last `maxFailures` runs
 * @param firstError date of the first error across all runs (null if none)
 * @param lastError date of the most recent error across all runs (null if none)
 * @param maxFailures threshold of consecutive errors to consider disabling
 * @param maxFailuresCooldownHours how far back in time errors must span to count as a cooldown breach
 */
export const shouldDisableForFailures = (
  errors: number,
  firstError: Date | null,
  lastError: Date | null,
  maxFailures: number,
  maxFailuresCooldownHours: number
): boolean => {
  const allErrors = errors === maxFailures
  const cooldownReached = firstError && lastError
    ? (lastError.getTime() - firstError.getTime()) / (1000 * 60 * 60) >= maxFailuresCooldownHours
    : false
  return allErrors && cooldownReached
}

/**
 * Build the mongo `$set` payload for the run's terminal status.
 * Pure: returns the new status patch, never mutates input.
 */
export const buildFinishStatusPatch = (
  currentStatus: string,
  errorMessage: string | undefined,
  finishedAt: string
): { status: 'finished' | 'killed' | 'error', finishedAt: string } => {
  if (currentStatus === 'killed') return { status: 'killed', finishedAt }
  if (errorMessage) return { status: 'error', finishedAt }
  return { status: 'finished', finishedAt }
}
