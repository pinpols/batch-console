#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(readFileSync(join(root, 'config/frontend-env.json'), 'utf8'))
const errors = []
const variables = Array.isArray(registry.variables) ? registry.variables : []
const declared = new Set()
const used = new Map()
const scanExtensions = new Set(['.ts', '.tsx', '.vue', '.mjs', '.cjs'])

if (!Array.isArray(registry.variables)) {
  errors.push('variables 必须是数组')
}

for (const [index, item] of variables.entries()) {
  const name = typeof item?.name === 'string' ? item.name : ''
  if (!name) {
    errors.push(`variables[${index}] 缺少 name`)
  } else {
    if (!/^VITE_[A-Z0-9_]+$/.test(name)) errors.push(`${name} name 格式无效`)
    if (declared.has(name)) errors.push(`${name} 重复登记`)
    declared.add(name)
  }
  if (!['build', 'development', 'runtime'].includes(item?.phase)) {
    errors.push(`${name || `variables[${index}]`} phase 无效`)
  }
  if (typeof item?.owner !== 'string' || !item.owner.trim()) {
    errors.push(`${name || `variables[${index}]`} 缺少 owner`)
  }
  if (typeof item?.required !== 'boolean') {
    errors.push(`${name || `variables[${index}]`} required 必须是布尔值`)
  }
  if (typeof item?.sensitive !== 'boolean') {
    errors.push(`${name || `variables[${index}]`} sensitive 必须是布尔值`)
  }
  if (typeof item?.default !== 'string') {
    errors.push(`${name || `variables[${index}]`} default 必须是字符串`)
  }
}

function scanFile(path) {
  if (!existsSync(path) || !statSync(path).isFile()) return
  const text = readFileSync(path, 'utf8')
  for (const match of text.matchAll(/\bVITE_[A-Z0-9_]+\b/g)) {
    if (!used.has(match[0])) used.set(match[0], relative(root, path))
  }
}

function scan(dir, extensions = scanExtensions) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) scan(path, extensions)
    else if (extensions.has(extname(path))) scanFile(path)
  }
}
scan(join(root, 'src'))
scan(join(root, 'scripts'))
for (const file of [
  'index.html',
  'vite.config.ts',
  'playwright.config.cjs',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.deploy.yml',
  '.env.development',
  '.env.production',
]) scanFile(join(root, file))
scan(join(root, '.github', 'workflows'), new Set(['.yml', '.yaml']))

for (const [name, file] of used)
  if (!declared.has(name)) errors.push(`${name} 使用于 ${file}，但未登记`)
for (const name of declared)
  if (!used.has(name)) errors.push(`${name} 已登记但代码未使用`)
if (errors.length) {
  console.error('[env-governance] 检查失败:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}
console.log(`[env-governance] 通过，共登记 ${declared.size} 个变量`)
