import type { Processing } from '#types'
import { v2compat } from '@json-layout/core/compat/v2'

// The plugin config schema as an agent editor (openapi-mcp) consumes it: converted from the vjsf v2
// syntax, and with the context the UI gives vjsf resolved in place, since the agent editor passes no
// context. Urls are relative to the site, the way the platform tools call the other services.
export const agentConfigSchema = (schema: Record<string, any>, processing: Pick<Processing, 'owner'>): Record<string, any> => {
  const { owner } = processing
  const replacements: Record<string, string> = {
    '{context.dataFairUrl}': '/data-fair',
    '{context.directoryUrl}': '/simple-directory',
    '{context.ownerFilter}': `owner=${owner.type}:${owner.id}${owner.department ? ':' + owner.department : ''}`,
    '{context.owner.type}': owner.type,
    '{context.owner.id}': owner.id,
    '{context.owner.department}': owner.department ?? ''
  }
  const resolve = (value: any): any => {
    if (typeof value === 'string') {
      let resolved = value
      for (const [placeholder, replacement] of Object.entries(replacements)) {
        // v2compat writes js templates (${context.x}), native layouts use {context.x}
        resolved = resolved.replaceAll('$' + placeholder, replacement).replaceAll(placeholder, replacement)
      }
      return resolved
    }
    if (Array.isArray(value)) return value.map(resolve)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]))
    return value
  }
  return resolve(v2compat(structuredClone(schema)))
}
