import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { summarizeVitest, summarizePlaywright, renderSummary } from '../ci/report-test-summary.mjs'

test('Vitest 汇总区分成功、失败和跳过', () => {
  assert.deepEqual(
    summarizeVitest({
      numTotalTests: 5,
      numPassedTests: 3,
      numFailedTests: 1,
      numPendingTests: 1,
      success: false,
    }),
    { total: 5, passed: 3, failed: 1, skipped: 1, flaky: 0 },
  )
})

test('Playwright 汇总保留重试成功和跳过', () => {
  assert.deepEqual(
    summarizePlaywright({ stats: { expected: 3, unexpected: 1, skipped: 2, flaky: 1 } }),
    { total: 7, passed: 3, failed: 1, skipped: 2, flaky: 1 },
  )
})

test('缺失报告与未运行不显示为通过', () => {
  const output = renderSummary([
    { name: 'unit', state: 'missing' },
    { name: 'visual', state: 'skipped' },
  ])
  assert.match(output, /unit \| missing/)
  assert.match(output, /visual \| skipped/)
})

test('执行成功却缺失报告时汇总失败，未执行则明确跳过', () => {
  const path = mkdtempSync(join(tmpdir(), 'frontend-ci-report-'))
  const script = resolve('scripts/ci/report-test-summary.mjs')
  try {
    const run = (outcome) =>
      spawnSync(process.execPath, [script, 'vitest', path], {
        encoding: 'utf8',
        env: { ...process.env, TEST_OUTCOME: outcome },
      })
    assert.equal(run('success').status, 1)
    const skipped = run('skipped')
    assert.equal(skipped.status, 0)
    assert.match(skipped.stdout, /Vitest \| skipped/)
    writeFileSync(
      join(path, 'vitest.json'),
      JSON.stringify({
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 1,
      }),
    )
    assert.match(run('success').stdout, /Vitest \| skipped/)
    writeFileSync(
      join(path, 'vitest.json'),
      JSON.stringify({
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
      }),
    )
    assert.match(run('cancelled').stdout, /Vitest \| cancelled/)
    assert.match(run('skipped').stdout, /Vitest \| skipped/)
  } finally {
    rmSync(path, { recursive: true, force: true })
  }
})
