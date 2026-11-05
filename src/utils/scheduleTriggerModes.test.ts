import { describe, expect, it } from 'vitest'
import { isTriggerModeCompatible } from './scheduleTriggerModes'

describe('调度类型与触发模式兼容表（与后端一致）', () => {
  it.each([
    ['CRON', 'SCHEDULED', true],
    ['CRON', 'MANUAL', false],
    ['FIXED_RATE', 'MIXED', true],
    ['EVENT', 'EVENT', true],
    ['EVENT', 'SCHEDULED', false],
    ['MANUAL', 'API', true],
    ['MANUAL', 'SCHEDULED', false],
    ['CRON', '', true],
  ] as const)('%s + %s -> %s', (scheduleType, triggerMode, expected) => {
    expect(isTriggerModeCompatible(scheduleType, triggerMode)).toBe(expected)
  })
})
