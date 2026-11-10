import type { AxiosInstance } from 'axios'
import { readFileSync } from 'node:fs'
import { importPKCS8, SignJWT } from 'jose'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { baseURL, directoryUrl } from './axios.ts'

// the non human identity of dev/resources/users.json, admin of test_org1
export const scopeNhiId = 'test_scope_nhi'
const issuer = 'https://processings-tests.example.com'
const subject = 'scope-tests'
// the site origin simple-directory sees (reqSiteUrl), the assertion audience
const audience = new URL(baseURL).origin

const privateKey = await importPKCS8(
  readFileSync(new URL('../resources/nhi/test-nhi-key.pem', import.meta.url), 'utf8'),
  'RS256'
)

/**
 * Exchange an assertion of the test NHI for a session limited to the requested scope (no scope:
 * an unrestricted session). Returns an axios authenticated by the bearer access token.
 */
export const nhiSession = async (scope?: string): Promise<{ bearerAx: AxiosInstance, accessToken: string }> => {
  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-nhi-key' })
    .setIssuer(issuer)
    .setSubject(subject)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey)
  const res = await axiosBuilder({ baseURL }).post(`${directoryUrl}/api/auth/nhi-token`, { client_id: scopeNhiId, assertion, ...(scope ? { scope } : {}) })
  const accessToken: string = res.data.access_token
  return {
    bearerAx: axiosBuilder({ baseURL, headers: { authorization: `Bearer ${accessToken}` } }),
    accessToken
  }
}
