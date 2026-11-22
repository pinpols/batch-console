#!/usr/bin/env node
// 用途：检查脚本头注释与 scripts/README.md 索引，避免入口与说明漂移。
// 用法：在仓库根目录执行 node scripts/check-script-metadata.mjs。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_CODE = 'SCRIPT_METADATA'
const GATE_NAME = '脚本头与索引'
const EXEMPT_PREFIXES = ['scripts/archive/', 'e2e-data/archive/', 'e2e/archive/']
const HEADER_LINES = 8
const USAGE_PATTERN = /^#\s*用途：/m
const INVOCATION_PATTERN = /^#\s*用法：/m

export function shellFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.sh'],
    { cwd: root, encoding: 'utf8' },
  )
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => !EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix)))
}

export function checkMetadata(files, readme, read) {
  const errors = []
  for (const file of files) {
    const source = read(file)
    if (source === null) continue
    const header = source.split('\n').slice(0, HEADER_LINES).join('\n')
    if (!USAGE_PATTERN.test(header)) errors.push(`${file}: 缺少 "# 用途：" 头注释`)
    if (!INVOCATION_PATTERN.test(header)) errors.push(`${file}: 缺少 "# 用法：" 头注释`)
    if (file.startsWith('scripts/') && !readme.includes(file)) {
      errors.push(`${file}: 未登记到 scripts/README.md`)
    }
  }
  return errors
}

export function main() {
  const files = shellFiles()
  const readmePath = join(root, 'scripts/README.md')
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : ''
  const errors = checkMetadata(files, readme, (file) => {
    const absolute = join(root, file)
    return existsSync(absolute) ? readFileSync(absolute, 'utf8') : null
  })
  if (!readme) errors.push('缺少 scripts/README.md 脚本索引')
  if (errors.length > 0) {
    console.error(`❌ 不通过 | code=${GATE_CODE} | gate=${GATE_NAME} | exit_code=1`)
    for (const error of errors) console.error(`  - ${error}`)
    return 1
  }
  console.log(`✅ 通过 | code=${GATE_CODE} | gate=${GATE_NAME} | files=${files.length}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
