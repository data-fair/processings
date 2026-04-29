// Pure helpers extracted from limits.ts.

/**
 * Compute remaining quota for a given key on a Limit document.
 * Returns -1 when the limit is unlimited (-1), otherwise max(0, limit - consumption).
 * When the limit is missing, returns 0 (treated as fully consumed).
 */
export const calculateRemainingLimit = (
  limits: Record<string, any> | null | undefined,
  key: string
): number => {
  const limit = limits?.[key]?.limit
  if (limit === -1) return -1
  if (limit == null) return 0
  const consumption = limits?.[key]?.consumption ?? 0
  return Math.max(0, limit - consumption)
}
