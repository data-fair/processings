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

/**
 * Format a Node.js MemoryUsage as a compact one-liner, suitable for logging.
 * All values are rounded to MB.
 */
export const formatMemoryUsage = (mem: NodeJS.MemoryUsage = process.memoryUsage()): string => {
  const mb = (n: number) => Math.round(n / 1024 / 1024)
  return `rss=${mb(mem.rss)}MB heap=${mb(mem.heapUsed)}/${mb(mem.heapTotal)}MB ext=${mb(mem.external)}MB`
}

/**
 * Map a non-zero child exit code to a human hint about likely causes.
 * Returns an empty string when no specific hint applies.
 * - 134 = SIGABRT, the signature of a V8 fatal allocation failure (std::bad_alloc / Check failed: (result.ptr) != nullptr).
 * - 137 = SIGKILL, the signature of an OOM-kill from the host kernel / docker cgroup.
 */
export const exitCodeHint = (code: number | null | undefined): string => {
  if (code === 134) return 'le processus enfant a abandonné (SIGABRT, code 134) — typique d\'une allocation V8 impossible. Vérifier NODE_OPTIONS=--max-old-space-size et la limite mémoire du conteneur (mem_limit / resources.limits.memory).'
  if (code === 137) return 'le processus enfant a été tué (SIGKILL, code 137) — typique d\'un OOM-kill par le noyau / cgroup. Augmenter la limite mémoire du conteneur (mem_limit / resources.limits.memory).'
  return ''
}
