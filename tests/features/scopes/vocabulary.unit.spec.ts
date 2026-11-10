import { test, expect } from '@playwright/test'
import { acceptedScopes, scopeDescriptions, scopedOperations } from '../../../api/src/scopes.ts'

test.describe('scope vocabulary', () => {
  test('a tier accepts its own scope, the umbrella and the global tier, never a lower tier', () => {
    const read = acceptedScopes('processings', 'read')
    expect(read).toEqual(expect.arrayContaining(['processings:read', 'processings', 'all:read']))
    const admin = acceptedScopes('processings', 'admin')
    expect(admin).not.toContain('processings:write')
    expect(admin).not.toContain('all:write')
    expect(admin).toEqual(expect.arrayContaining(['processings:admin', 'processings', 'all:admin']))
  })

  test('scope descriptions are localized', () => {
    expect(scopeDescriptions('en')['processings:write']).toBe('Create and configure processings, trigger and kill their runs')
    expect(scopeDescriptions('fr')['processings:read']).toBe('Lire les traitements du compte, leurs exécutions et leurs journaux')
  })

  test('every session-facing operation is listed once', () => {
    expect(Object.keys(scopedOperations).sort()).toEqual([
      'deleteProcessing', 'deleteProcessingWebhookKey', 'getAccountLimits', 'getPluginConfigSchema',
      'getProcessing', 'getProcessingConfig', 'getProcessingPlugin', 'getProcessingWebhookKey', 'getRun',
      'killRun', 'listProcessings', 'listRuns', 'patchProcessing', 'postProcessing', 'putProcessingConfig',
      'triggerProcessing'
    ])
    const routes = Object.values(scopedOperations).map(op => `${op.method} ${op.path}`)
    expect(new Set(routes).size).toBe(routes.length)
    const tiers = Object.fromEntries(Object.entries(scopedOperations).map(([id, op]) => [id, op.tier]))
    expect(tiers).toMatchObject({
      listProcessings: 'read',
      getRun: 'read',
      getAccountLimits: 'read',
      postProcessing: 'write',
      patchProcessing: 'write',
      putProcessingConfig: 'write',
      triggerProcessing: 'write',
      killRun: 'write',
      deleteProcessing: 'admin',
      getProcessingWebhookKey: 'admin',
      deleteProcessingWebhookKey: 'admin'
    })
  })
})
