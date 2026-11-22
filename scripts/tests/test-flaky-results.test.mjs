// 用途：验证 flaky 报告的隔离匹配与到期判定。
// 用法：在仓库根目录执行 node --test scripts/tests/test-flaky-results.test.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'

import { checkReport } from '../check-flaky-results.mjs'

const report = {
  suites: [
    {
      title: 'e2e',
      specs: [{ title: 'flaky case', tests: [{ status: 'flaky' }] }],
      suites: [],
    },
  ],
}
const today = '2026-11-22'

test('未登记的 flaky 用例被拦截', () => {
  assert.match(checkReport(report, {}, today).join('\n'), /未登记/)
})

test('登记的 flaky 用例通过', () => {
  const quarantine = { 'e2e > flaky case': { issue: '#1', owner: '@team', expires: '2026-12-31' } }
  assert.equal(checkReport(report, quarantine, today).join('\n'), '')
})

test('过期隔离被拦截', () => {
  const quarantine = { 'e2e > flaky case': { issue: '#1', owner: '@team', expires: '2026-01-01' } }
  assert.match(checkReport(report, quarantine, today).join('\n'), /到期/)
})
