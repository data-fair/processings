// operations.ts — pure functions only
// must not import #mongo, #config, or store state

import type { Processing } from '#types'
import { httpError } from '@data-fair/lib-utils/http-errors.js'

/**
 * `lib-express/error-handler.js` collapses every AxiosRequestError to 500, so
 * we translate registry failures into user-facing messages at the
 * boundary. 403/404 keep their status (the UI relies on them to show its
 * "plugin broken" banner); anything else is a registry outage → 502.
 */
export const translateRegistryError = (err: any, processing: Pick<Processing, 'plugin' | 'owner'>) => {
  const status = err?.status ?? err?.statusCode
  const ownerLabel = processing.owner.name ?? processing.owner.id
  if (status === 403) return httpError(403, `The account ${ownerLabel} has no access to the plugin ${processing.plugin}.`)
  if (status === 404) return httpError(404, `The plugin ${processing.plugin} was not found in the registry.`)
  return httpError(502, 'The plugins registry is temporarily unavailable.')
}
