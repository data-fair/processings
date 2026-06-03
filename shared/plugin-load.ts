import path from 'node:path'
import fs from 'fs-extra'

/**
 * Resolve a plugin's entry point from its package.json#main and dynamic-import it.
 *
 * Plugins can ship pre-built JS (main: "index.js") or rely on Node's built-in
 * type-stripping (main: "index.ts"). Either way, callers should not hard-code
 * an extension — read main and trust it.
 *
 * No cache-busting is needed: lib-node-registry (>=0.7.0) extracts each plugin
 * version into its own directory, so an updated plugin resolves to a fresh URL
 * and Node's module registry reloads the whole graph naturally.
 */
export const importPluginModule = async <T = unknown>(
  pluginDir: string
): Promise<T> => {
  const pkg = await fs.readJson(path.join(pluginDir, 'package.json'))
  const mainRel = typeof pkg.main === 'string' && pkg.main.length > 0 ? pkg.main : 'index.js'
  const mainAbs = path.resolve(pluginDir, mainRel)
  if (!(await fs.pathExists(mainAbs))) {
    throw new Error(`fichier source manquant : ${mainAbs}`)
  }
  return (await import(mainAbs)) as T
}
