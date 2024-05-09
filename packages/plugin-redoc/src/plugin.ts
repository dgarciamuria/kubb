import path from 'node:path'

import { PluginManager, createPlugin } from '@kubb/core'
import { camelCase, trimExtName } from '@kubb/core/transformers'
import { pluginSwaggerName } from '@kubb/swagger'

import type { Plugin } from '@kubb/core'
import type { PluginSwagger } from '@kubb/swagger'
import { getPageHTML } from './redoc.tsx'
import type { PluginRedoc } from './types.ts'

export const pluginRedocName = 'plugin-redoc' satisfies PluginRedoc['name']

export const pluginRedoc = createPlugin<PluginRedoc>((options) => {
  const { output = { path: 'docs.html' } } = options

  return {
    name: pluginRedocName,
    options: {
      name: trimExtName(output.path),
      baseURL: undefined,
    },
    pre: [pluginSwaggerName],
    resolvePath(baseName) {
      const root = path.resolve(this.config.root, this.config.output.path)

      return path.resolve(root, baseName)
    },
    resolveName(name, type) {
      return camelCase(name, { isFile: type === 'file' })
    },
    async writeFile(source, writePath) {
      if (!writePath.endsWith('.ts') || !source) {
        return
      }

      return this.fileManager.write(source, writePath, { sanity: false })
    },
    async buildStart() {
      const [swaggerPlugin]: [Plugin<PluginSwagger>] = PluginManager.getDependedPlugins<PluginSwagger>(this.plugins, [pluginSwaggerName])
      const oas = await swaggerPlugin.api.getOas()

      await oas.dereference()

      const root = path.resolve(this.config.root, this.config.output.path)
      const pageHTML = await getPageHTML(oas.api)

      await this.fileManager.write(pageHTML, path.resolve(root, output.path || './docs.html'))
    },
  }
})