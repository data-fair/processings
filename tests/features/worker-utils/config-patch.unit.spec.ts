import { test, expect } from '@playwright/test'
import { applyConfigPatch } from '../../../worker/src/utils/config-patch.ts'

test.describe('applyConfigPatch', () => {
  test('merges new keys and overwrites existing ones', () => {
    const config: Record<string, any> = { mode: 'analyse', url: 'https://portal.test' }
    applyConfigPatch(config, { mode: 'import', haveList: true })
    expect(config).toEqual({ mode: 'import', url: 'https://portal.test', haveList: true })
  })

  test('removes a key patched with null, like the API does', () => {
    const config: Record<string, any> = { mode: 'import', publicationSite: 'portal:site1' }
    applyConfigPatch(config, { publicationSite: null })
    expect(config).toEqual({ mode: 'import' })
    expect('publicationSite' in config).toBe(false)
  })

  test('keeps falsy values that are not null', () => {
    const config: Record<string, any> = { makePublic: true, threshold: 1.5, label: 'x' }
    applyConfigPatch(config, { makePublic: false, threshold: 0, label: '' })
    expect(config).toEqual({ makePublic: false, threshold: 0, label: '' })
  })

  test('removes a key patched with undefined, as the mongo client already did on write', () => {
    const config: Record<string, any> = { datasetMode: 'update', datasets: [{ id: 'ds1' }] }
    applyConfigPatch(config, { dataset: { id: 'ds1' }, datasets: undefined })
    expect(config).toEqual({ datasetMode: 'update', dataset: { id: 'ds1' } })
    expect('datasets' in config).toBe(false)
  })

  test('is a shallow merge: a nested object is replaced, not merged', () => {
    const config: Record<string, any> = { dataset: { id: 'ds1', title: 'old' } }
    applyConfigPatch(config, { dataset: { id: 'ds2' } })
    expect(config).toEqual({ dataset: { id: 'ds2' } })
  })

  test('removing a missing key is a no-op', () => {
    const config: Record<string, any> = { mode: 'import' }
    applyConfigPatch(config, { publicationSite: null })
    expect(config).toEqual({ mode: 'import' })
  })

  test('mutates and returns the same config object', () => {
    const config: Record<string, any> = { a: 1 }
    expect(applyConfigPatch(config, { b: 2 })).toBe(config)
  })
})
