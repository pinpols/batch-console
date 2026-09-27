#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(readFileSync(join(root, 'config/frontend-env.json'), 'utf8'))
const declared = new Set(registry.variables.map((item) => item.name))
const used = new Map()
const scanExtensions = new Set(['.ts', '.tsx', '.vue', '.mjs', '.cjs'])

function scan(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) scan(path)
    else if (scanExtensions.has(extname(path))) {
      const text = readFileSync(path, 'utf8')
      for (const match of text.matchAll(/\bVITE_[A-Z0-9_]+\b/g)) {
        if (!used.has(match[0])) used.set(match[0], relative(root, path))
      }
    }
  }
}
scan(join(root, 'src'))
scan(join(root, 'scripts'))
for (const file of ['vite.config.ts', 'playwright.config.cjs']) {
  const text = readFileSync(join(root, file), 'utf8')
  for (const match of text.matchAll(/\bVITE_[A-Z0-9_]+\b/g)) used.set(match[0], file)
}

const errors = []
for (const [name, file] of used)
  if (!declared.has(name)) errors.push(`${name} 使用于 ${file}，但未登记`)
for (const name of declared)
  if (!used.has(name) && name !== 'VITE_APP_TITLE') errors.push(`${name} 已登记但代码未使用`)
for (const item of registry.variables) {
  if (!['build', 'development', 'runtime'].includes(item.phase))
    errors.push(`${item.name} phase 无效`)
  if (!item.owner) errors.push(`${item.name} 缺少 owner`)
}
if (errors.length) {
  console.error('[env-governance] 检查失败:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}
console.log(`[env-governance] 通过，共登记 ${declared.size} 个变量`)
