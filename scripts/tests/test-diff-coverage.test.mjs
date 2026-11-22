// 用途：验证增量覆盖率对 diff 行号和 statementMap 的解析。
// 用法：在仓库根目录执行 node --test scripts/tests/test-diff-coverage.test.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'

import { computeDiffCoverage, parseDiff } from '../check-diff-coverage.mjs'

const diff = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -0,0 +1,2 @@',
  '+export const a = 1',
  '+export const b = 2',
  '@@ -10,0 +13,1 @@',
  '+export const c = 3',
].join('\n')

const coverage = {
  [resolve('src/a.ts')]: {
    statementMap: {
      0: { start: { line: 1 }, end: { line: 1 } },
      1: { start: { line: 2 }, end: { line: 2 } },
      2: { start: { line: 13 }, end: { line: 13 } },
      3: { start: { line: 99 }, end: { line: 99 } },
    },
    s: { 0: 1, 1: 0, 2: 1, 3: 0 },
  },
}

test('解析新增行号', () => {
  const changes = parseDiff(diff)
  assert.deepEqual(
    [...changes.get('src/a.ts')].sort((a, b) => a - b),
    [1, 2, 13],
  )
})

test('只统计变更行的语句覆盖率', () => {
  const result = computeDiffCoverage(diff, coverage, 70)
  assert.equal(result.covered, 2)
  assert.equal(result.total, 3)
  assert.equal(result.passed, false)
})

test('没有可执行变更时视为通过', () => {
  const empty = computeDiffCoverage('', coverage, 70)
  assert.equal(empty.total, 0)
  assert.equal(empty.passed, true)
})
