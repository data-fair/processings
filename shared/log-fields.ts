// Log fields shared by the api and the worker (see the "Logging" section of AGENTS.md), as in data-fair.
// The actor (accountKey, userId...) comes from the request log context; the owner of a processing uses owner*.
// Config-free on purpose: only plain values.
// TODO: move ownerLogFields to lib-node (data-fair, catalogs, events, agents and simple-directory hold the same copy).

export type OwnerLike = { type: string, id: string, name?: string, department?: string }

export type OwnerLogFields = { ownerKey: string, ownerDep: string | undefined, ownerName: string | undefined }

// the 3 keys are always present, possibly undefined: pino drops undefined values from the line
export const ownerLogFields = (owner: OwnerLike): OwnerLogFields => ({
  ownerKey: owner.type + '.' + owner.id,
  ownerDep: owner.department || undefined,
  ownerName: owner.name || undefined
})

// log lines must stay small: cut any value that carries plugin output or user content
export const truncateLogValue = (value: string, max = 1000): string => value.length > max ? value.slice(0, max) + '…' : value
