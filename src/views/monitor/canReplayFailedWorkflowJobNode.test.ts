import { describe, expect, it } from 'vitest'
import { canReplayFailedWorkflowJobNode } from './canReplayFailedWorkflowJobNode'

describe('canReplayFailedWorkflowJobNode', () => {
  it('allows only a failed JOB node with a linked instance in a failed Workflow run', () => {
    expect(canReplayFailedWorkflowJobNode('FAILED', 'JOB', 'FAILED', 42)).toBe(true)
  })

  it.each([
    ['running Workflow', 'RUNNING', 'JOB', 'FAILED', 42],
    ['successful Workflow', 'SUCCESS', 'JOB', 'FAILED', 42],
    ['non JOB node', 'FAILED', 'WAIT', 'FAILED', 42],
    ['non failed node', 'FAILED', 'JOB', 'RUNNING', 42],
    ['missing instance', 'FAILED', 'JOB', 'FAILED', null],
    ['unsafe instance id', 'FAILED', 'JOB', 'FAILED', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s', (_name, run, type, status, instanceId) => {
    expect(canReplayFailedWorkflowJobNode(run, type, status, instanceId)).toBe(false)
  })
})
