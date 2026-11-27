import { test, expect } from '@playwright/test'
import { fetchAllPages, pluginFromList } from '../../../ui/src/utils/registry-plugins.ts'

// The list page used to ask the processings API for the plugin of every card, one request (and one 404 in the console
// for a removed plugin) per processing. It now reads the registry list once, page by page.

test.describe('reading every page of a registry list', () => {
  test('reads past the registry cap of 100 until count is reached', async () => {
    const items = Array.from({ length: 230 }, (_, i) => i)
    const skips: number[] = []
    const all = await fetchAllPages(async skip => {
      skips.push(skip)
      return { results: items.slice(skip, skip + 100), count: items.length }
    })
    expect(all).toEqual(items)
    expect(skips).toEqual([0, 100, 200])
  })

  test('stops on an empty page even if count says more', async () => {
    let calls = 0
    const all = await fetchAllPages(async () => {
      calls++
      return { results: calls === 1 ? [1, 2] : [], count: 10 }
    })
    expect(all).toEqual([1, 2])
    expect(calls).toBe(2)
  })
})

test.describe('telling a plugin from the list or from the owner', () => {
  const org1 = { type: 'organization', id: 'org1' }

  test('a processing of the active account reads the list, whatever its department', () => {
    expect(pluginFromList({ ...org1 }, org1, false)).toBe(true)
    expect(pluginFromList({ ...org1, department: 'dep1' } as any, org1, false)).toBe(true)
  })

  test('a processing shared from another account asks the owner', () => {
    expect(pluginFromList({ type: 'organization', id: 'org2' }, org1, false)).toBe(false)
    expect(pluginFromList({ type: 'user', id: 'org1' }, org1, false)).toBe(false)
    expect(pluginFromList(undefined, org1, false)).toBe(false)
  })

  test('a super admin in admin mode sees the whole registry', () => {
    expect(pluginFromList({ type: 'organization', id: 'org2' }, org1, true)).toBe(true)
  })
})
