// The OAuth-style scope vocabulary processings declares: the processings family with read, write and
// admin tiers and its bare umbrella, plus the global tier scopes all:read / all:write / all:admin
// shared by every service of the platform. Every session-facing route is listed in scopedOperations
// and guarded by requireOperationScope; any other route refuses scope-restricted sessions
// (lib-express). The OpenAPI document (api/contract/api-docs.ts) is built from the same table.
import type { RequestHandler } from 'express'
import type { ScopeTier } from '@data-fair/lib-common-types/scopes.js'
import { defineScopes } from '@data-fair/lib-common-types/scopes.js'
import { requireScope } from '@data-fair/lib-express/index.js'

export const vocabulary = defineScopes({
  processings: {
    tiers: ['read', 'write', 'admin'],
    descriptions: {
      umbrella: { en: 'All processing scopes', fr: 'Tous les droits sur les traitements' },
      read: { en: "Read the account's processings, their runs and logs", fr: 'Lire les traitements du compte, leurs exécutions et leurs journaux' },
      write: { en: 'Create and configure processings, trigger and kill their runs', fr: 'Créer et configurer les traitements, déclencher et arrêter leurs exécutions' },
      admin: { en: 'Delete processings, manage their permissions, owner and webhook key', fr: 'Supprimer les traitements, gérer leurs permissions, leur propriétaire et leur clé de webhook' }
    }
  }
})
export const { acceptedScopes, scopeDescriptions } = vocabulary
export type ScopeFamily = typeof vocabulary.families[number]

export type ScopedOperation = { method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, family: ScopeFamily, tier: ScopeTier }

// paths are relative to /api/v1, as in the OpenAPI document
export const scopedOperations = {
  listProcessings: { method: 'get', path: '/processings', family: 'processings', tier: 'read' },
  getProcessing: { method: 'get', path: '/processings/{id}', family: 'processings', tier: 'read' },
  getProcessingConfig: { method: 'get', path: '/processings/{id}/config', family: 'processings', tier: 'read' },
  getPluginConfigSchema: { method: 'get', path: '/processings/{id}/plugin-config-schema', family: 'processings', tier: 'read' },
  getProcessingPlugin: { method: 'get', path: '/processings/{id}/plugin', family: 'processings', tier: 'read' },
  listRuns: { method: 'get', path: '/runs', family: 'processings', tier: 'read' },
  getRun: { method: 'get', path: '/runs/{id}', family: 'processings', tier: 'read' },
  getAccountLimits: { method: 'get', path: '/limits/{type}/{id}', family: 'processings', tier: 'read' },
  postProcessing: { method: 'post', path: '/processings', family: 'processings', tier: 'write' },
  // the admin fields of the body (permissions, owner) also need the admin tier, checked by the route
  patchProcessing: { method: 'patch', path: '/processings/{id}', family: 'processings', tier: 'write' },
  putProcessingConfig: { method: 'put', path: '/processings/{id}/config', family: 'processings', tier: 'write' },
  // with a webhook key the route reads no session and checks no scope
  triggerProcessing: { method: 'post', path: '/processings/{id}/_trigger', family: 'processings', tier: 'write' },
  killRun: { method: 'post', path: '/runs/{id}/_kill', family: 'processings', tier: 'write' },
  deleteProcessing: { method: 'delete', path: '/processings/{id}', family: 'processings', tier: 'admin' },
  getProcessingWebhookKey: { method: 'get', path: '/processings/{id}/webhook-key', family: 'processings', tier: 'admin' },
  deleteProcessingWebhookKey: { method: 'delete', path: '/processings/{id}/webhook-key', family: 'processings', tier: 'admin' }
} satisfies Record<string, ScopedOperation>

export type ScopedOperationId = keyof typeof scopedOperations

export const requireOperationScope = (operationId: ScopedOperationId): RequestHandler => {
  const operation: ScopedOperation | undefined = scopedOperations[operationId]
  if (!operation) throw new Error(`unknown scoped operation ${operationId}`)
  return requireScope(acceptedScopes(operation.family, operation.tier))
}
