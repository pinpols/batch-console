#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, '.github/workflows')
const errors = []
for (const name of readdirSync(dir).filter(
  (file) => file.endsWith('.yml') || file.endsWith('.yaml'),
)) {
  const text = readFileSync(join(dir, name), 'utf8')
  for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
    const action = match[1]
    if (action.startsWith('./')) continue
    if (action.startsWith('docker://')) {
      if (!/@sha256:[0-9a-f]{64}$/.test(action))
        errors.push(`${name}: Docker Action 必须固定 tag + sha256 digest: ${action}`)
      continue
    }
    if (!/@[0-9a-f]{40}$/.test(action))
      errors.push(`${name}: 外部 Action 必须固定 40 位 commit SHA: ${action}`)
  }
  if (/runs-on:\s*ubuntu-latest\b/.test(text))
    errors.push(`${name}: Ubuntu runner 必须使用显式版本，禁止 ubuntu-latest`)
  if (!/^permissions:/m.test(text)) errors.push(`${name}: 缺少显式顶层 permissions`)
}
if (errors.length) {
  errors.forEach((error) => console.error(`[workflows] ${error}`))
  process.exit(1)
}
console.log('[workflows] 基础安全检查通过')
