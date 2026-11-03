import { describe, expect, it } from 'vitest'
import { validateWorkflowScheduleLengths } from './workflowScheduleValidation'

const valid = {
  scheduleType: 'CRON',
  scheduleExpr: '0 0 2 * * *',
  timezone: 'UTC',
  calendarCode: 'CALENDAR',
  dependsOnJobCode: 'JOB',
}

describe('Workflow 调度字段长度', () => {
  it.each([
    ['scheduleExpr', 256],
    ['timezone', 64],
    ['calendarCode', 128],
    ['dependsOnJobCode', 128],
  ] as const)('%s 接受上限并拦截超长值', (field, max) => {
    expect(validateWorkflowScheduleLengths({ ...valid, [field]: 'a'.repeat(max) })).toBeNull()
    expect(validateWorkflowScheduleLengths({ ...valid, [field]: 'a'.repeat(max + 1) })).toEqual({
      field,
      max,
    })
  })

  it('手动调度不会提交隐藏的旧表达式', () => {
    expect(
      validateWorkflowScheduleLengths({
        ...valid,
        scheduleType: 'MANUAL',
        scheduleExpr: 'a'.repeat(257),
      }),
    ).toBeNull()
  })
})
