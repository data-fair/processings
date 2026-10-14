import { test as base, expect, request, type BrowserContext } from '@playwright/test'

const baseUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT}`
const directoryUrl = `${baseUrl}/simple-directory`

type Cookies = Awaited<ReturnType<BrowserContext['cookies']>>

// One API login per user and worker process. id_token lives 15 min: log in again after 10.
const sessions = new Map<string, { cookies: Cookies, at: number }>()
const maxAge = 10 * 60 * 1000

const apiLogin = async (user: string): Promise<Cookies> => {
  const cached = sessions.get(user)
  if (cached && Date.now() - cached.at < maxAge) return cached.cookies
  const ctx = await request.newContext()
  try {
    // no adminMode: e2e specs browse with a normal session, superadmin included
    const res = await ctx.post(`${directoryUrl}/api/auth/password`, {
      params: { redirect: directoryUrl },
      data: { email: `${user}@test.com`, password: user === 'test_superadmin' ? 'superpasswd' : 'passwd' }
    })
    if (!res.ok()) throw new Error(`login of ${user} failed: ${res.status()} ${await res.text()}`)
    // the callback sets the session cookies (id_token, id_token_sign, id_token_ex) and redirects
    const callback = await ctx.get(await res.text(), { maxRedirects: 0 })
    if (callback.status() !== 302) throw new Error(`login callback of ${user} answered ${callback.status()}`)
    const { cookies } = await ctx.storageState()
    sessions.set(user, { cookies, at: Date.now() })
    return cookies
  } finally {
    await ctx.dispose()
  }
}

export const test = base.extend<{
  goToWithAuth: (url: string, user: string) => Promise<void>
}>({
  page: async ({ page }, use) => {
    await page.context().addCookies([
      { name: 'i18n_lang', value: 'fr', url: baseUrl },
      { name: 'cache_bypass', value: '1', url: baseUrl }
    ])
    // lib-vue skips its keepalive while this timestamp is recent: a future one turns it off, so the
    // browser never rotates the single-use exchange token that every test of this worker shares
    await page.addInitScript(() => window.localStorage.setItem('sd-keepalive', String(Date.now() + 365 * 86400e3)))
    await use(page)
  },

  goToWithAuth: async ({ page, context }, use) => {
    await use(async (url: string, user: string) => {
      await context.addCookies(await apiLogin(user))
      await page.goto(url)
    })
  }
})

export { expect }
