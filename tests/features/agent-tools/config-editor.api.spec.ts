import { test, expect } from '@playwright/test'
import { load } from '@data-fair/openapi-mcp'
import { anonymousAx, axiosAuth, baseURL, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

test.describe('config editor tools', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('the processing_config tools fill and save the config of a processing', async () => {
    const plugin = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
    const admin = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
    const processing = (await admin.post('/api/v1/processings', { title: 'Editor processing', plugin: plugin.pluginId })).data

    const doc = (await anonymousAx.get('/api/v1/api-docs.json', { headers: { 'Accept-Language': 'en' } })).data
    const toolSet = await load(doc, { baseUrl: `${baseURL}/api/v1`, lint: 'error' })
    const tool = (name: string) => toolSet.tools.find(t => t.name === `processing_config_${name}`)!
    // records the urls the editor session fetches (its schema, the document, the suggestions)
    const fetched: string[] = []
    const recordingFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetched.push(input instanceof Request ? input.url : String(input))
      return fetch(input, init)
    }) as typeof fetch
    const ctx = { headers: { cookie: admin.cookieJar.getCookieStringSync(baseURL) }, identity: 'test_admin1', fetch: recordingFetch }
    const call = async (name: string, params: Record<string, unknown>) => {
      const res = await tool(name).execute({ id: processing._id, ...params }, ctx)
      if (process.env.DEBUG_EDITOR) console.log(name, JSON.stringify(params), '\n', res.text)
      return res
    }

    const state = await call('describeState', {})
    expect(state.isError).toBeFalsy()
    expect(state.text).toContain('message')

    expect((await call('setFieldValue', { path: '/$allOf-1/message', value: 'Hello agent' })).isError).toBeFalsy()
    // the update variant picks an existing dataset, its suggestions come from data-fair (relative url resolved by the api)
    expect((await call('setFieldValue', { path: '/$allOf-0/$oneOf', value: 1 })).isError).toBeFalsy()
    await call('getFieldSuggestions', { path: '/$allOf-0/$oneOf/1/dataset' })
    // the fixture's itemsResults ("results", not an expression on data) fails to evaluate after the
    // download, in the UI too: what is checked here is that the download reached data-fair, filtered
    // on the owner of the processing
    const datasets = fetched.map(u => new URL(u)).find(u => u.pathname === '/data-fair/api/v1/datasets')
    expect(datasets?.searchParams.get('owner')).toBe('organization:test_org1')
    // back to a dataset to create, then save
    expect((await call('setFieldValue', { path: '/$allOf-0/$oneOf', value: 0 })).isError).toBeFalsy()
    expect((await call('setFieldValue', { path: '/$allOf-0/$oneOf/0/dataset/title', value: 'Agent dataset' })).isError).toBeFalsy()
    expect((await call('saveForm', {})).isError).toBeFalsy()

    const config = (await admin.get(`/api/v1/processings/${processing._id}/config`)).data
    expect(config).toMatchObject({ datasetMode: 'create', dataset: { title: 'Agent dataset' }, message: 'Hello agent' })
  })
})
