export type RegistryPage<T> = { results: T[], count: number }

/** Read every page of a registry list. The registry caps `size` at 100, so a single call silently misses the rest. */
export const fetchAllPages = async <T>(fetchPage: (skip: number) => Promise<RegistryPage<T>>): Promise<T[]> => {
  const all: T[] = []
  for (;;) {
    const page = await fetchPage(all.length)
    all.push(...page.results)
    if (!page.results.length || all.length >= page.count) return all
  }
}

type AccountRef = { type: string, id: string }

/**
 * Whether the registry list read with the session can tell a processing's plugin, or the card must ask the
 * processings API, which reads the registry as the processing's owner.
 *
 * The registry filters its list by the session's active account (type and id, the department plays no part), or
 * shows everything to a super admin in admin mode. A processing of that same account sees exactly the list: a
 * plugin absent from it is one the owner cannot see. A processing shared from another account (by email or as a
 * partner, listed with `?owner=`) may use a plugin the viewer's account cannot see, which must not read as deleted.
 */
export const pluginFromList = (owner: AccountRef | undefined, sessionAccount: AccountRef | undefined, adminMode: boolean): boolean => {
  if (adminMode) return true
  if (!owner || !sessionAccount) return false
  return owner.type === sessionAccount.type && owner.id === sessionAccount.id
}
