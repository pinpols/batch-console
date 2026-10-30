import { describe, expect, it, vi } from 'vitest'
import type { ConsoleWorkflowNodeRunResponse } from '@/types/console-api'
import { workflowNodeSkipReasonText } from './workflowNodeSkipReason'

const row = (overrides: Partial<ConsoleWorkflowNodeRunResponse> = {}) =>
  ({ nodeStatus: 'SKIPPED', ...overrides }) as ConsoleWorkflowNodeRunResponse

describe('workflowNodeSkipReasonText', () => {
  it('shows the persisted operator explanation before translated category', () => {
    const translate = vi.fn((key: string) => key)

    expect(
      workflowNodeSkipReasonText(
        row({ skipReasonCode: 'OPERATOR_SKIPPED', skipReason: 'approved bypass' }),
        translate,
      ),
    ).toBe('approved bypass')
    expect(translate).not.toHaveBeenCalled()
  })

  it('translates a stored condition skip category', () => {
    expect(
      workflowNodeSkipReasonText(row({ skipReasonCode: 'CONDITION_NOT_MATCHED' }), key => key),
    ).toBe('monitor.nodeSkipReasonConditionNotMatched')
  })

  it('marks old skipped rows without a recorded reason', () => {
    expect(workflowNodeSkipReasonText(row(), key => key)).toBe('monitor.nodeSkipReasonUnknown')
  })

  it('does not show skip copy for other node states', () => {
    expect(
      workflowNodeSkipReasonText(row({ nodeStatus: 'SUCCESS' }), key => key),
    ).toBe('')
  })
})
