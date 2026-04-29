// Pure helpers extracted from worker.ts.

/**
 * Reconstruct an error message from a child process stderr,
 * filtering out noise that is not relevant to the user.
 * Falls back to the original error message when stderr produces nothing useful.
 */
export const buildErrorMessageFromStderr = (stderr: string, errMessage: string): string => {
  const lines: string[] = []
  if (stderr) {
    for (const line of stderr.split('\n')) {
      if (!line) continue
      if (line.startsWith('worker:')) continue
      if (line.includes('NODE_TLS_REJECT_UNAUTHORIZED')) continue
      lines.push(line)
    }
  }
  if (!lines.length) lines.push(errMessage)
  return lines.join('\n')
}
