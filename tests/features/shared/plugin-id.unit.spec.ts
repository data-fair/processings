import { test, expect } from '@playwright/test'
import { parsePluginId } from '../../../shared/plugin-id.ts'

test.describe('parsePluginId', () => {
  test('parses versioned npm pluginId with scoped name', () => {
    expect(parsePluginId('@data-fair/processing-hello-world@2')).toEqual({
      name: '@data-fair/processing-hello-world',
      major: '2'
    })
  })

  test('parses versioned npm pluginId with unscoped name', () => {
    expect(parsePluginId('hello-world@5')).toEqual({
      name: 'hello-world',
      major: '5'
    })
  })

  test('parses scoped branch pluginId (no @major suffix)', () => {
    expect(parsePluginId('@data-fair/processing-hello-world-main')).toEqual({
      name: '@data-fair/processing-hello-world-main'
    })
  })

  test('parses unscoped branch pluginId', () => {
    expect(parsePluginId('hello-world-dev')).toEqual({
      name: 'hello-world-dev'
    })
  })

  test('throws on empty input', () => {
    expect(() => parsePluginId('')).toThrow()
  })
})
