// operations.ts — pure functions only
// must not import #mongo, #config, or store state

import type { Processing } from '#types'
import { httpError } from '@data-fair/lib-utils/http-errors.js'

/**
 * `lib-express/error-handler.js` collapses every AxiosRequestError to 500, so
 * we translate registry failures into user-facing French messages at the
 * boundary. 403/404 keep their status (the UI relies on them to show its
 * "plugin broken" banner); anything else is a registry outage → 502.
 */
export const translateRegistryError = (err: any, processing: Pick<Processing, 'plugin' | 'owner'>) => {
  const status = err?.status ?? err?.statusCode
  const ownerLabel = processing.owner.name ?? processing.owner.id
  if (status === 403) return httpError(403, `Le compte ${ownerLabel} n'a pas accès au plugin ${processing.plugin}.`)
  if (status === 404) return httpError(404, `Le plugin ${processing.plugin} est introuvable dans le registre.`)
  return httpError(502, 'Le registre des plugins est temporairement indisponible.')
}
