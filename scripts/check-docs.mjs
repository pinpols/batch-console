#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = resolve(root, '../file-batch-system')
const roots = [
  join(root, 'README.md'),
  join(root, 'AGENTS.md'),
  join(root, 'CONTRIBUTING.md'),
  join(root, 'SECURITY.md'),
  join(root, 'docs'),
]
const skippedDirs = new Set(['archive', 'reports', 'qa', 'verifications', 'analysis'])
const files = []

function walk(path) {
  const stat = statSync(path)
  if (stat.isFile()) {
    if (extname(path) === '.md') files.push(path)
    return
  }
  for (const name of readdirSync(path)) {
    if (skippedDirs.has(name)) continue
    walk(join(path, name))
  }
}
roots.forEach(walk)

const errors = []
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g

function isInside(parent, target) {
  const path = relative(parent, target)
  return path === '' || (path !== '..' && !path.startsWith('../') && !isAbsolute(path))
}

for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const text = readFileSync(file, 'utf8')
  const checkedText = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '')
  if (/\/(?:Users|home)\/[\w.-]+\//.test(checkedText) || /[A-Z]:\\Users\\/.test(checkedText)) {
    errors.push(`${rel}: 包含个人机器绝对路径`)
  }
  for (const match of checkedText.matchAll(linkPattern)) {
    const raw = match[1].trim().replace(/^<|>$/g, '')
    if (!raw || /^(?:https?:|mailto:|#|javascript:)/.test(raw)) continue
    const pathPart = decodeURIComponent(raw.split('#')[0].split('?')[0])
    if (!pathPart) continue
    const target = pathPart.startsWith('/')
      ? join(root, pathPart)
      : resolve(dirname(file), pathPart)
    // 配对后端在本地是同级仓库，CI 单仓 checkout 时无法验证其文件是否存在。
    if (isInside(backendRoot, target)) continue
    const candidates = [target, `${target}.md`, join(target, 'README.md'), join(target, 'index.md')]
    if (!candidates.some(existsSync)) errors.push(`${rel}: 无效链接 ${raw}`)
  }
}

if (errors.length) {
  console.error('[docs] 检查失败:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}
console.log(`[docs] 通过，共检查 ${files.length} 个当前文档`)
