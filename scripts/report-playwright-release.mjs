#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const reportPath = resolve(process.argv[2] || 'playwright-report/results.json')
if (!existsSync(reportPath)) {
  console.error(`[release-e2e] Playwright JSON report not found: ${reportPath}`)
  process.exit(1)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const scenarios = []

function visit(suite, inheritedFile = '') {
  const file = suite.file || inheritedFile
  for (const spec of suite.specs || []) {
    const results = spec.tests?.flatMap((test) => test.results || []) || []
    const result = results.at(-1)
    const status =
      result?.status ||
      (spec.tests?.some((test) => test.status === 'skipped') ? 'skipped' : 'not-run')
    scenarios.push({
      file: spec.file || file || 'unknown',
      title: spec.title,
      status,
      reason:
        result?.error?.message ||
        result?.errors?.[0]?.message ||
        result?.annotations?.find((item) => item.type === 'skip')?.description ||
        '',
      required: spec.title.includes('@release-required'),
    })
  }
  for (const child of suite.suites || []) visit(child, file)
}

for (const suite of report.suites || []) visit(suite)

const counts = scenarios.reduce(
  (totals, scenario) => {
    const key =
      scenario.status === 'passed' ? 'PASS' : scenario.status === 'skipped' ? 'SKIP' : 'FAIL'
    totals[key] += 1
    return totals
  },
  { PASS: 0, SKIP: 0, FAIL: 0 },
)

const lines = [
  '## Staging E2E scenario results',
  '',
  `PASS: ${counts.PASS} · SKIP: ${counts.SKIP} · FAIL/NOT-RUN: ${counts.FAIL}`,
  '',
  '| Status | Scenario | File | Note |',
  '|---|---|---|---|',
  ...scenarios.map((scenario) => {
    const status =
      scenario.status === 'passed' ? 'PASS' : scenario.status === 'skipped' ? 'SKIP' : 'FAIL'
    return `| ${status}${scenario.required ? ' (required)' : ''} | ${scenario.title} | ${scenario.file} | ${(scenario.reason || '').replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 240)} |`
  }),
]
const summary = `${lines.join('\n')}\n`
process.stdout.write(summary)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)

const skippedRequired = scenarios.filter(
  (scenario) => scenario.required && scenario.status !== 'passed',
)
const requiredCount = scenarios.filter((scenario) => scenario.required).length
if (requiredCount === 0) {
  console.error('[release-e2e] no @release-required scenarios were discovered')
  process.exit(1)
}
if (skippedRequired.length > 0) {
  console.error(`[release-e2e] ${skippedRequired.length} required scenario(s) did not pass`)
  process.exit(1)
}
