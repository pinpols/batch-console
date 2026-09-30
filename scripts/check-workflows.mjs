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
  if (/uses:\s*[^\s]+@(?:master|main)\b/.test(text))
    errors.push(`${name}: Action 禁止跟随 master/main`)
  if (/runs-on:\s*ubuntu-latest\b/.test(text))
    errors.push(`${name}: Ubuntu runner 必须使用显式版本，禁止 ubuntu-latest`)
  if (!/^permissions:/m.test(text)) errors.push(`${name}: 缺少显式顶层 permissions`)
}
if (errors.length) {
  errors.forEach((error) => console.error(`[workflows] ${error}`))
  process.exit(1)
}
console.log('[workflows] 基础安全检查通过')
