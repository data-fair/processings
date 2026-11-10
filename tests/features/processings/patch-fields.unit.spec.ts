import { test, expect } from '@playwright/test'
import { patchableFields, processingPatchFields } from '../../../api/src/processings/patch-fields.ts'

test.describe('processing patch fields', () => {
  test('the write and admin tiers split the patchable fields exactly', () => {
    const { write, admin } = processingPatchFields
    expect(write.filter(f => (admin as readonly string[]).includes(f))).toEqual([])
    expect([...write, ...admin].sort()).toEqual([...patchableFields(false)].sort())
  })

  test('read-only parts are not patchable outside admin mode', () => {
    const fields = patchableFields(false)
    for (const f of ['plugin', 'webhookKey', 'secrets', 'lastRun', '_id']) expect(fields).not.toContain(f)
    expect(patchableFields(true)).toEqual(expect.arrayContaining(['plugin', 'webhookKey', '_id', 'owner']))
  })
})
