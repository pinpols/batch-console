#!/usr/bin/env node
// 用途：校验本次变更新增或修改的可执行行是否达到覆盖率门槛。
// 用法：在仓库根目录执行 node scripts/check-diff-coverage.mjs [--base origin/main] [--coverage coverage/coverage-final.json] [--threshold 70]。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_CODE = 'FE_DIFF_COVERAGE'
const GATE_NAME = '增量覆盖率'

function parseArgs(argv) {
  const options = {
    base: process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main',
    coverage: 'coverage/coverage-final.json',
    threshold: 70,
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base') options.base = argv[++index]
    else if (argv[index] === '--coverage') options.coverage = argv[++index]
    else if (argv[index] === '--threshold') options.threshold = Number(argv[++index])
  }
  return options
}

export function parseDiff(diffText) {
  const changes = new Map()
  let current = null
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ b/')) {
      current = line.slice('+++ b/'.length)
      if (!changes.has(current)) changes.set(current, new Set())
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!hunk || !current) continue
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    for (let offset = 0; offset < count; offset += 1) changes.get(current).add(start + offset)
  }
  return changes
}

export function computeDiffCoverage(diffText, coverage, threshold) {
  const changes = parseDiff(diffText)
  const files = {}
  let covered = 0
  let total = 0
  for (const [file, lines] of changes) {
    if (lines.size === 0 || !/\.(ts|tsx|js|mjs|vue)$/.test(file)) continue
    const absolute = resolve(root, file)
    const entry =
      coverage[absolute] ??
      Object.entries(coverage).find(([candidate]) => candidate.endsWith(`/${file}`))?.[1]
    if (!entry?.statementMap || !entry?.s) continue
    let fileCovered = 0
    let fileTotal = 0
    for (const [id, statement] of Object.entries(entry.statementMap)) {
      if (!lines.has(statement.start.line)) continue
      fileTotal += 1
      if (entry.s[id] > 0) fileCovered += 1
    }
    if (fileTotal === 0) continue
    files[file] = { covered: fileCovered, total: fileTotal }
    covered += fileCovered
    total += fileTotal
  }
  const percent = total === 0 ? 100 : (covered / total) * 100
  return { files, covered, total, percent, passed: percent >= threshold }
}

function loadCoverage(path) {
  if (!existsSync(path)) {
    console.error(
      `覆盖率文件不存在: ${path}（先运行 npm run test:unit -- --coverage --coverage.reporter=json）`,
    )
    return null
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function main() {
  const options = parseArgs(process.argv.slice(2))
  const coverage = loadCoverage(resolve(root, options.coverage))
  if (!coverage) return 2
  const diff = execFileSync(
    'git',
    ['diff', '--unified=0', `${options.base}...HEAD`, '--', 'src', 'e2e/fixtures'],
    { cwd: root, encoding: 'utf8' },
  )
  const result = computeDiffCoverage(diff, coverage, options.threshold)
  for (const [file, stat] of Object.entries(result.files)) {
    console.log(`  - ${file}: ${stat.covered}/${stat.total}`)
  }
  const summary = `covered=${result.covered} total=${result.total} percent=${result.percent.toFixed(2)} threshold=${options.threshold}`
  if (!result.passed) {
    console.error(`❌ 不通过 | code=${GATE_CODE} | gate=${GATE_NAME} | exit_code=1`)
    console.error(`  - 新增/修改可执行行覆盖率不足：${summary}`)
    return 1
  }
  console.log(`✅ 通过 | code=${GATE_CODE} | gate=${GATE_NAME} | ${summary}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
