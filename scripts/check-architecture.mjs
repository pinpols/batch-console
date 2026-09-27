#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(root, 'src')
const sourceExtensions = new Set(['.ts', '.tsx', '.vue'])
const files = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if (sourceExtensions.has(extname(path)) && !path.endsWith('.test.ts')) files.push(path)
  }
}

walk(srcRoot)

const errors = []
const graph = new Map()
const importPattern =
  /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gm
const pageLayerExceptions = new Set([
  // 设计器锁与画布 Pinia store 是同一业务子系统；后续迁移 store 时删除该例外。
  'src/composables/useLockManager.ts|@/views/workflow/designer/store/useDesignerStore',
])

function resolveSource(from, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
  const base = specifier.startsWith('@/')
    ? join(srcRoot, specifier.slice(2))
    : resolve(dirname(from), specifier)
  for (const candidate of [base, ...[...sourceExtensions].map((ext) => `${base}${ext}`)]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  for (const ext of sourceExtensions) {
    const candidate = join(base, `index${ext}`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const text = readFileSync(file, 'utf8')
  const imports = []
  for (const match of text.matchAll(importPattern)) {
    const specifier = match[1]
    if (specifier === '@/api/client' && !rel.startsWith('src/api/')) {
      errors.push(`${rel}: 禁止绕过领域 API 直接导入 @/api/client`)
    }
    if (
      (rel.startsWith('src/api/') ||
        rel.startsWith('src/components/') ||
        rel.startsWith('src/composables/') ||
        rel.startsWith('src/stores/') ||
        rel.startsWith('src/utils/')) &&
      (specifier.startsWith('@/views/') || specifier.startsWith('@/views-mobile/')) &&
      !pageLayerExceptions.has(`${rel}|${specifier}`)
    ) {
      errors.push(`${rel}: 基础层禁止反向依赖页面层 ${specifier}`)
    }
    const target = resolveSource(file, specifier)
    if (target) imports.push(target)
  }
  graph.set(file, imports)
}

const state = new Map()
const stack = []
const cycles = new Set()
function visit(file) {
  if (state.get(file) === 2) return
  if (state.get(file) === 1) {
    const start = stack.indexOf(file)
    const cycle = [...stack.slice(start), file]
      .map((item) => relative(srcRoot, item).replaceAll('\\', '/'))
      .join(' -> ')
    cycles.add(cycle)
    return
  }
  state.set(file, 1)
  stack.push(file)
  for (const target of graph.get(file) ?? []) visit(target)
  stack.pop()
  state.set(file, 2)
}
for (const file of files) visit(file)
for (const cycle of cycles) errors.push(`循环依赖: ${cycle}`)

if (errors.length) {
  console.error('[architecture] 检查失败:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log(`[architecture] 通过，共检查 ${files.length} 个源文件`)
