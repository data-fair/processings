import { resolvedSchema as processingSchema } from '#types/processing/index.ts'

// the parts of a processing a PATCH may change, by scope tier: the admin tier also gives the
// processing away or opens it to others
export const processingPatchFields = {
  write: ['title', 'active', 'scheduling', 'config'],
  admin: ['permissions', 'owner']
} as const

const properties: Record<string, { readOnly?: boolean }> = processingSchema.properties

// the editable properties of the processing schema, plus the owner (its route checks the new owner);
// every property in admin mode
export const patchableFields = (adminMode: boolean): string[] => Object.keys(properties)
  .filter(k => adminMode || !properties[k].readOnly || k === 'owner')
