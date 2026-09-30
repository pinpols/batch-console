#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const decoder = new TextDecoder('utf-8', { fatal: true })

// 业务文件可以按模板声明其他字符集；该样本用于验证错误编码识别，不属于平台源码。
const allowedNonUtf8 = new Set([
  'e2e-data/06-file-pipeline/samples/sample-invalid-encoding.csv',
])
const extensionlessBinaryFiles = new Set(['design/.thumbnail'])

const binaryExtensions = new Set([
  '.avif',
  '.bin',
  '.bmp',
  '.eot',
  '.gif',
  '.gz',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.tar',
  '.ttf',
  '.webp',
  '.woff',
  '.woff2',
  '.xls',
  '.xlsx',
  '.zip',
])

function repositoryFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root },
  )
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
}

const failures = []
let checked = 0

for (const file of repositoryFiles()) {
  if (
    allowedNonUtf8.has(file) ||
    extensionlessBinaryFiles.has(file) ||
    binaryExtensions.has(extname(file).toLowerCase())
  ) {
    continue
  }

  const bytes = readFileSync(resolve(root, file))
  checked += 1
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    failures.push(`${file}: UTF-8 BOM`)
    continue
  }

  try {
    decoder.decode(bytes)
  } catch {
    failures.push(`${file}: 不是有效的 UTF-8`)
  }
}

if (failures.length > 0) {
  console.error('[encoding] 平台文本文件必须使用 UTF-8（无 BOM）:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `[encoding] 通过：检查 ${checked} 个平台文本文件；保留 ${allowedNonUtf8.size} 个业务编码反例样本`,
)
