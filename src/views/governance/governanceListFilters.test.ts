import { describe, expect, it } from 'vitest'
import type {
  GovernanceQueueRow,
  GovernanceBatchWindowRow,
  GovernanceCalendarRow,
} from '@/api/governance'
import {
  filterGovernanceQueues,
  filterGovernanceWindows,
  filterGovernanceCalendars,
} from './governanceListFilters'

const queue: GovernanceQueueRow = {
  id: 1,
  tenantId: 'tenant-a',
  queueCode: 'REPORTS',
  queueName: 'Daily reports',
  queueType: 'FIFO',
  fairShareGroup: 'daily',
  concurrentCap: null,
  burstLimit: null,
  enabled: true,
  updatedAt: '',
}
const window: GovernanceBatchWindowRow = {
  id: 2,
  tenantId: 'tenant-a',
  windowCode: 'CLOSE',
  windowName: 'Settlement',
  timezone: 'Asia/Shanghai',
  startTime: '09:00',
  endTime: '18:00',
  endStrategy: 'WAIT',
  crossDayPolicy: 'NEXT_DAY',
  outOfWindowAction: 'DEFER',
  allowCrossDay: true,
  enabled: false,
  description: '',
  updatedAt: '',
}
const calendar: GovernanceCalendarRow = {
  id: 3,
  tenantId: 'tenant-a',
  calendarCode: 'TRADING',
  calendarName: 'Market days',
  timezone: 'Asia/Shanghai',
  enabled: true,
  updatedAt: '',
}

describe('governanceListFilters', () => {
  it('队列关键词忽略边界空格和大小写，启用状态单独约束', () => {
    const matched = filterGovernanceQueues([queue], ' reports ', undefined)
    const excluded = filterGovernanceQueues([queue], 'reports', false)
    expect(matched).toEqual([queue])
    expect(excluded).toEqual([])
  })

  it('窗口按跨日策略检索且允许明确选择停用记录', () => {
    const matched = filterGovernanceWindows([window], ' next_day ', false)
    const excluded = filterGovernanceWindows([window], '', true)
    expect(matched).toEqual([window])
    expect(excluded).toEqual([])
  })

  it('日历保留按时区查询，空关键词不会丢失记录', () => {
    const matched = filterGovernanceCalendars([calendar], ' shanghai ', true)
    const unfiltered = filterGovernanceCalendars([calendar], '', undefined)
    expect(matched).toEqual([calendar])
    expect(unfiltered).toEqual([calendar])
  })
})
