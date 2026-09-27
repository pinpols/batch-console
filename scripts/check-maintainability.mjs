#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const baselinePath = join(root, 'config', 'maintainability-baseline.json')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const extensions = new Set(['.ts', '.tsx', '.vue'])
const errors = []
const observed = []

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
      else if (!rel.startsWith('src/locales/') && lines > 1200) {
        const allowed = baseline[rel]
        if (allowed === undefined) {
          errors.push(`${rel}: ${lines} 行，新增大文件未登记基线`)
        } else if (lines > allowed) {
          errors.push(`${rel}: ${lines} 行，超过基线 ${allowed}`)
        } else {
          observed.push(`${rel}: ${lines}/${allowed} 行`)
        }
      }
    }
  }
}
walk(src)
if (errors.length) {
  errors.forEach((error) => console.error(`[maintainability] ${error}`))
  process.exit(1)
}
observed.forEach((item) => console.log(`[maintainability] 已登记: ${item}`))
console.log(`[maintainability] 通过，${observed.length} 个存量大文件未新增行数`)
