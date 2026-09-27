#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const extensions = new Set(['.ts', '.tsx', '.vue'])
const errors = []
const warnings = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if (extensions.has(extname(path)) && !path.endsWith('api.generated.ts')) {
      const rel = relative(root, path).replaceAll('\\', '/')
      const lines = readFileSync(path, 'utf8').split('\n').length
      const hardLimit = rel.startsWith('src/locales/')
        ? 6000
        : rel === 'src/router/index.ts'
          ? 1200
          : 2000
      if (lines > hardLimit) errors.push(`${rel}: ${lines} 行，超过上限 ${hardLimit}`)
      else if (!rel.startsWith('src/locales/') && lines > 1200) warnings.push(`${rel}: ${lines} 行`)
    }
  }
}
walk(src)
warnings.forEach((warning) => console.warn(`[maintainability] 建议拆分: ${warning}`))
if (errors.length) {
  errors.forEach((error) => console.error(`[maintainability] ${error}`))
  process.exit(1)
}
console.log(`[maintainability] 通过，${warnings.length} 个大文件进入观察清单`)
