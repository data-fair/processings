import { test, expect } from '@playwright/test'
import { translateRegistryError } from '../../../api/src/processings/operations.ts'

// the api specs plugin-access and plugin-info-transitivity check the real registry round trip;
// the message of each status lives here
const processing = { plugin: '@test-plugin-1', owner: { type: 'user', id: 'test_user1', name: 'Test User 1' } } as any

test.describe('translateRegistryError', () => {
  test('403 names the owner and the plugin', () => {
    const err = translateRegistryError({ status: 403 }, processing)
    expect(err.status).toBe(403)
    expect(err.message).toBe("Le compte Test User 1 n'a pas accès au plugin @test-plugin-1.")
  })

  test('403 falls back to the owner id without a name', () => {
    const err = translateRegistryError({ statusCode: 403 }, { ...processing, owner: { type: 'user', id: 'test_user1' } })
    expect(err.message).toContain('Le compte test_user1 ')
  })

  test('404 says the plugin is missing from the registry', () => {
    const err = translateRegistryError({ status: 404 }, processing)
    expect(err.status).toBe(404)
    expect(err.message).toBe('Le plugin @test-plugin-1 est introuvable dans le registre.')
  })

  test('anything else is a registry outage (502)', () => {
    expect(translateRegistryError({ status: 500 }, processing).status).toBe(502)
    expect(translateRegistryError(new Error('ECONNREFUSED'), processing).status).toBe(502)
  })
})
