import { test as base, expect } from '@playwright/test'

const cookieCache = new Map<string, Awaited<ReturnType<import('@playwright/test').BrowserContext['cookies']>>>()

async function performLogin (page: any, context: any, baseUrl: string, url: string, user: string) {
  const fullUrl = `${baseUrl}${url}`
  const password = user === 'test_superadmin' ? 'superpasswd' : 'passwd'
  const loginUrl = `${baseUrl}/simple-directory/login?redirect=${encodeURIComponent(fullUrl)}`
  await page.goto(loginUrl)
  await page.getByLabel('Adresse mail').fill(`${user}@test.com`)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(fullUrl, { timeout: 10000 })
  const cookies = await context.cookies()
  cookieCache.set(user, cookies)
}

export const test = base.extend<{
  goToWithAuth: (url: string, user: string) => Promise<void>
}>({
      page: async ({ page }, use) => {
        const baseUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT1}`
        await page.context().addCookies([{
          name: 'i18n_lang',
          value: 'fr',
          url: baseUrl
        }, {
          name: 'cache_bypass',
          value: '1',
          url: baseUrl
        }])
        await use(page)
      },

      goToWithAuth: async ({ page, context }, use) => {
        const baseUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT1}`
        const goToWithAuth = async (url: string, user: string) => {
          const cached = cookieCache.get(user)
          if (cached) {
            await context.addCookies(cached)
            await page.goto(url)
            if (page.url().includes('/simple-directory/login')) {
              cookieCache.delete(user)
              await performLogin(page, context, baseUrl, url, user)
            }
          } else {
            await performLogin(page, context, baseUrl, url, user)
          }
        }
        await use(goToWithAuth)
      }
    })

export { expect }
