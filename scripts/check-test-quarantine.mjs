#!/usr/bin/env node
// 用途：阻止静默跳过的测试，并要求隔离项声明 Issue、责任人与到期日。
// 用法：在仓库根目录执行 node scripts/check-test-quarantine.mjs [--today YYYY-MM-DD]。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_CODE = 'TEST_QUARANTINE'
const GATE_NAME = '测试隔离治理'
const UNCONDITIONAL = /\.(skip|fixme)\(\s*(['"`]|\))/
const EXCLUSIVE = /\.only\(/
const ANNOTATION = /quarantine:\s*issue=(\S+)\s+owner=(@?\S+)\s+expires=(\d{4}-\d{2}-\d{2})/

export function testFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src', 'e2e'],
    { cwd: root, encoding: 'utf8' },
  )
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(file))
}

export function checkContent(file, content, today) {
  const errors = []
  const lines = content.split('\n')
  lines.forEach((line, index) => {
    if (EXCLUSIVE.test(line)) {
      errors.push(`${file}:${index + 1}: exclusive-test: 提交中不能保留 .only`)
    }
    if (!UNCONDITIONAL.test(line)) return
    const annotation = `${lines[index - 1] ?? ''}\n${line}`
    const match = ANNOTATION.exec(annotation)
    if (!match) {
      errors.push(
        `${file}:${index + 1}: missing-quarantine: 无条件跳过需声明 issue、owner 和 expires`,
      )
      return
    }
    if (match[3] < today) {
      errors.push(`${file}:${index + 1}: expired-quarantine: 隔离已于 ${match[3]} 到期`)
    }
  })
  return errors
}

export function main() {
  const today = new Date().toISOString().slice(0, 10)
  const errors = []
  for (const file of testFiles()) {
    const absolute = join(root, file)
    if (!existsSync(absolute)) continue
    errors.push(...checkContent(file, readFileSync(absolute, 'utf8'), today))
  }
  if (errors.length > 0) {
    console.error(`❌ 不通过 | code=${GATE_CODE} | gate=${GATE_NAME} | exit_code=1`)
    for (const error of errors) console.error(`  - ${error}`)
    return 1
  }
  console.log(`✅ 通过 | code=${GATE_CODE} | gate=${GATE_NAME}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
