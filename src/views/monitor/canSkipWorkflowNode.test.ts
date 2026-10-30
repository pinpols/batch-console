import { describe, expect, it } from 'vitest'
import { canSkipWorkflowNode } from './canSkipWorkflowNode'

describe('canSkipWorkflowNode', () => {
  it('allows skipping only failed nodes', () => {
    expect(canSkipWorkflowNode('FAILED')).toBe(true)
    expect(canSkipWorkflowNode('failed')).toBe(true)
    for (const status of ['PENDING', 'RUNNING', 'WAITING', 'SUCCESS', 'SKIPPED', 'CANCELLED']) {
      expect(canSkipWorkflowNode(status)).toBe(false)
    }
    expect(canSkipWorkflowNode(null)).toBe(false)
  })
})
