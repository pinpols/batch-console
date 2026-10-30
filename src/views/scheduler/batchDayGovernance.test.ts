import { describe, expect, it } from 'vitest'
import { availableBatchDayActions, validGapRange } from './batchDayGovernance'
describe('批次日治理合法动作与缺口范围', () => {
  it('未知状态或冻结事实缺失时不提供写操作', () => {
    expect(availableBatchDayActions(null)).toEqual([])
    expect(availableBatchDayActions({ dayStatus: 'FUTURE', frozen: false })).toEqual([])
    expect(availableBatchDayActions({ dayStatus: 'IN_FLIGHT' })).toEqual([])
  })
  it('冻结、终态重开、人工放行和空日结算保持各自语义', () => {
    expect(availableBatchDayActions({ dayStatus: 'IN_FLIGHT', frozen: false })).toEqual([
      'FREEZE',
      'RELEASE',
      'SKIP',
      'CLOSE',
    ])
    expect(availableBatchDayActions({ dayStatus: 'IN_FLIGHT', frozen: true })).toEqual([
      'RELEASE',
      'SKIP',
      'CLOSE',
    ])
    expect(availableBatchDayActions({ dayStatus: 'SETTLED', frozen: false })).toEqual([
      'RELEASE',
      'REOPEN',
    ])
    expect(availableBatchDayActions({ dayStatus: 'CUTOFF', frozen: false })).toContain(
      'SETTLE_EMPTY',
    )
    expect(availableBatchDayActions({ dayStatus: 'SKIPPED', frozen: false })).toEqual([
      'RELEASE',
      'REOPEN',
      'CLOSE',
    ])
  })
  it('历史缺口限制真实日期、起止顺序与最多90个日期', () => {
    expect(validGapRange('2026-02-30', '2026-03-01')).toBe(false)
    expect(validGapRange('2026-03-01', '2026-02-01')).toBe(false)
    expect(validGapRange('2026-01-01', '2026-03-31')).toBe(true)
    expect(validGapRange('2026-01-01', '2026-04-01')).toBe(false)
    expect(validGapRange('2026-10-25', '2026-10-26', '2026-10-25')).toBe(false)
  })
})
