import path from 'node:path'
import fs from 'fs-extra'

/**
 * Resolve a plugin's entry point from its package.json#main and dynamic-import it.
 *
 * Plugins can ship pre-built JS (main: "index.js") or rely on Node's built-in
 * type-stripping (main: "index.ts"). Either way, callers should not hard-code
 * an extension — read main and trust it.
 *
 * `cacheBust` appends a query string so the same module path can be re-imported
 * fresh in the same process (used by the API's `prepare` flow, which may run
 * twice in one save).
 */
export const importPluginModule = async <T = unknown>(
  pluginDir: string,
  opts: { cacheBust?: boolean } = {}
): Promise<T> => {
  const pkg = await fs.readJson(path.join(pluginDir, 'package.json'))
  const mainRel = typeof pkg.main === 'string' && pkg.main.length > 0 ? pkg.main : 'index.js'
  const mainAbs = path.resolve(pluginDir, mainRel)
  if (!(await fs.pathExists(mainAbs))) {
    throw new Error(`fichier source manquant : ${mainAbs}`)
  }
  const url = opts.cacheBust ? `${mainAbs}?imported=${Date.now()}` : mainAbs
  return (await import(url)) as T
}
