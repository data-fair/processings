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

/**
 * Whether a mongo error means the updated document would exceed the 16MB limit
 * ("Resulting document after update is larger than 16777216").
 */
export const isDocumentTooLargeError = (err: any): boolean =>
  err?.code === 17419 || /larger than \d+/.test(err?.message ?? '')

/**
 * Cap a log msg/extra at `maxLength` chars. A non-string value that is too
 * long once serialized is replaced by its truncated serialization.
 */
export const truncateLogValue = (value: any, maxLength: number): any => {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (!str || str.length <= maxLength) return value
  return str.slice(0, maxLength) + '...'
}
