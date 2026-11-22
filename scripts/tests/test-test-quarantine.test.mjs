// 用途：验证静默跳过、.only 与隔离到期的判定。
// 用法：在仓库根目录执行 node --test scripts/tests/test-test-quarantine.test.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'

import { checkContent } from '../check-test-quarantine.mjs'

const today = '2026-11-22'

test('无条件跳过缺少隔离声明被拦截', () => {
  const errors = checkContent('src/a.test.ts', "test.skip('case', () => {})\n", today).join('\n')
  assert.match(errors, /missing-quarantine/)
})

test('带完整隔离声明的跳过通过', () => {
  const content = [
    '// quarantine: issue=#123 owner=@team expires=2026-12-31',
    "test.skip('case', () => {})",
  ].join('\n')
  assert.equal(checkContent('src/a.test.ts', content, today).join('\n'), '')
})

test('过期隔离被拦截', () => {
  const content = [
    '// quarantine: issue=#123 owner=@team expires=2026-01-01',
    "test.skip('case', () => {})",
  ].join('\n')
  assert.match(checkContent('src/a.test.ts', content, today).join('\n'), /expired-quarantine/)
})

test('条件跳过与 .only 规则', () => {
  assert.equal(checkContent('e2e/a.spec.ts', "test.skip(!seed, '无数据')\n", today).join('\n'), '')
  assert.match(
    checkContent('src/a.test.ts', "test.only('x', () => {})\n", today).join('\n'),
    /exclusive-test/,
  )
})
