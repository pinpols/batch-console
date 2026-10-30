import { describe, expect, it } from 'vitest'
import { canReplayWholeWorkflowRun } from './canReplayWholeWorkflowRun'

describe('canReplayWholeWorkflowRun', () => {
  it.each(['SUCCESS', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED', 'TERMINATED'])(
    'allows terminal status %s',
    (status) => {
      expect(canReplayWholeWorkflowRun(status)).toBe(true)
    },
  )

  it.each([null, undefined, '', 'CREATED', 'RUNNING', 'UNKNOWN'])(
    'rejects non-terminal status %s',
    (status) => {
      expect(canReplayWholeWorkflowRun(status)).toBe(false)
    },
  )
})
