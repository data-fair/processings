/**
 * Match a request URL against the configured data-fair URL.
 * Data-fair requests receive the data-fair API key and may reach a private address, so this is a
 * parsed comparison (same origin, path inside the base path) and not a string prefix:
 * https://df.example.com.evil.com or https://df.example.com@evil.com must not match https://df.example.com.
 * Returns undefined if the URL is not a data-fair URL, else the URL to request (rewritten to the
 * private data-fair URL if there is one).
 */
export const resolveDataFairUrl = (url: string, dataFairUrl: string, privateDataFairUrl?: string | null): string | undefined => {
  const base = new URL(dataFairUrl)
  const target = new URL(url)
  if (target.origin !== base.origin) return
  const basePath = base.pathname.replace(/\/$/, '')
  if (target.pathname !== basePath && !target.pathname.startsWith(basePath + '/')) return
  if (!privateDataFairUrl) return url
  const privateBase = new URL(privateDataFairUrl)
  return privateBase.origin + privateBase.pathname.replace(/\/$/, '') + target.pathname.slice(basePath.length) + target.search
}
