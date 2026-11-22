#!/usr/bin/env node
// 用途：校验 Playwright 报告中的 flaky 用例是否已登记责任人与到期日。
// 用法：在仓库根目录执行 node scripts/check-flaky-results.mjs [报告路径] [--today YYYY-MM-DD]。
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_CODE = 'FLAKY_RESULTS'
const GATE_NAME = 'flaky 结果治理'
const QUARANTINE_FILE = resolve(root, 'scripts/flaky-quarantine.json')

export function collectFlaky(suite, parents = [], results = []) {
  const titles = [...parents, suite.title].filter(Boolean)
  for (const spec of suite.specs ?? []) {
    const statuses = (spec.tests ?? []).map((test) => test.status)
    if (statuses.includes('flaky'))
      results.push([...titles, spec.title].filter(Boolean).join(' > '))
  }
  for (const child of suite.suites ?? []) collectFlaky(child, titles, results)
  return results
}

export function checkReport(report, quarantine, today) {
  const flaky = []
  for (const suite of report.suites ?? []) collectFlaky(suite, [], flaky)
  const errors = []
  for (const title of flaky) {
    const entry = quarantine[title]
    if (!entry) {
      errors.push(`${title}: flaky 用例未登记到 scripts/flaky-quarantine.json`)
      continue
    }
    if (!entry.issue || !entry.owner?.startsWith('@') || !entry.expires) {
      errors.push(`${title}: 隔离项必须包含 issue、@owner 和 expires`)
      continue
    }
    if (entry.expires < today) errors.push(`${title}: flaky 隔离已于 ${entry.expires} 到期`)
  }
  return errors
}

export function main() {
  const args = process.argv.slice(2)
  const todayIndex = args.indexOf('--today')
  const today = todayIndex >= 0 ? args[todayIndex + 1] : new Date().toISOString().slice(0, 10)
  const reportPath = resolve(
    root,
    args.find((arg) => !arg.startsWith('--') && arg !== today) ?? 'build/ci-test-reports/full.json',
  )
  if (!existsSync(reportPath)) {
    console.error(`报告文件不存在: ${reportPath}`)
    return 2
  }
  const quarantine = existsSync(QUARANTINE_FILE)
    ? JSON.parse(readFileSync(QUARANTINE_FILE, 'utf8'))
    : {}
  const errors = checkReport(JSON.parse(readFileSync(reportPath, 'utf8')), quarantine, today)
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
