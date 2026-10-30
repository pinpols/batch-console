#!/usr/bin/env node
// 汇总 Vitest / Playwright 原始报告，不把跳过或未生成的报告视为成功。
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function summarizeVitest(report) {
  const {
    numTotalTests: total,
    numPassedTests: passed,
    numFailedTests: failed,
    numPendingTests: skipped,
  } = report
  if (![total, passed, failed, skipped].every(Number.isFinite))
    throw new Error('Invalid Vitest report')
  return { total, passed, failed, skipped, flaky: 0 }
}

export function summarizePlaywright(report) {
  const { expected: passed, unexpected: failed, skipped, flaky } = report.stats || {}
  if (![passed, failed, skipped, flaky].every(Number.isFinite))
    throw new Error('Invalid Playwright report')
  return { total: passed + failed + skipped + flaky, passed, failed, skipped, flaky }
}

export function renderSummary(rows) {
  const lines = [
    '## Frontend test report',
    '',
    '| Suite | Status | Total | Passed | Failed | Skipped | Flaky |',
    '|---|---|---:|---:|---:|---:|---:|',
  ]
  for (const row of rows) {
    const values = row.counts || {}
    lines.push(
      `| ${row.name} | ${row.state} | ${values.total ?? '—'} | ${values.passed ?? '—'} | ${values.failed ?? '—'} | ${values.skipped ?? '—'} | ${values.flaky ?? '—'} |`,
    )
  }
  lines.push(
    '',
    'Each row is an execution; overlapping E2E suites are not deduplicated. Missing and skipped are not passes.',
    '',
  )
  return lines.join('\n')
}

function readRow(name, path, kind, outcome) {
  if (outcome === 'skipped' || outcome === 'cancelled') return { name, state: outcome }
  if (!existsSync(path)) return { name, state: 'missing' }
  const report = JSON.parse(readFileSync(path, 'utf8'))
  const counts = kind === 'vitest' ? summarizeVitest(report) : summarizePlaywright(report)
  const hasErrors = Array.isArray(report.errors) && report.errors.length > 0
  let state = 'passed'
  if (outcome === 'failure' || counts.failed || hasErrors) state = 'failure'
  else if (counts.total === 0 || counts.skipped === counts.total) state = 'skipped'
  else if (counts.flaky) state = 'flaky'
  return {
    name,
    state,
    counts,
  }
}

function main() {
  const kind = process.argv[2]
  const base = process.argv[3] || 'build/ci-test-reports'
  let rows
  if (kind === 'vitest') {
    rows = [readRow('Vitest', `${base}/vitest.json`, 'vitest', process.env.TEST_OUTCOME)]
  } else if (kind === 'playwright') {
    rows = ['full', 'visual', 'cross-browser'].map((name) =>
      readRow(
        `Playwright ${name}`,
        `${base}/${name}.json`,
        'playwright',
        process.env[`OUTCOME_${name.toUpperCase().replace('-', '_')}`],
      ),
    )
  } else {
    throw new Error('Usage: report-test-summary.mjs <vitest|playwright> [directory]')
  }
  const summary = renderSummary(rows)
  mkdirSync(base, { recursive: true })
  writeFileSync(`${base}/summary.md`, summary)
  writeFileSync(`${base}/summary.json`, `${JSON.stringify(rows, null, 2)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  process.stdout.write(summary)
  if (rows.some((row) => row.state === 'missing')) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main()
