import { describe, expect, it } from 'vitest'
import {
  executionGraph,
  executionNodeDisplayStatus,
  executionTotals,
  executionFocusNodeCodes,
} from './workflowExecutionGraph'
import type { components } from '@/types/api.generated'
type Node = components['schemas']['WorkflowExecutionNodeProgress']
const node = (nodeCode: string, nodeStatus: string): Node => ({
  nodeCode,
  nodeType: 'JOB',
  nodeStatus,
  activeSteps: [],
})
describe('executionGraph', () => {
  it('keeps all executing and waiting branches instead of using a single root cursor', () => {
    expect(
      executionFocusNodeCodes([
        { ...node('job-a', 'READY'), jobInstanceStatus: 'RUNNING' },
        node('job-b', 'WAITING_DEPENDENCY'),
        node('job-c', 'PAUSED'),
        node('future', 'PENDING'),
        node('end', 'NOT_EXECUTED'),
      ]),
    ).toEqual(['job-a', 'job-b', 'job-c'])
  })
  it('shows the failed node and leaves completed runs without a current execution node', () => {
    expect(
      executionFocusNodeCodes([node('failed-job', 'FAILED'), node('END', 'NOT_EXECUTED')]),
    ).toEqual(['failed-job'])
    expect(executionFocusNodeCodes([node('job', 'SUCCESS'), node('END', 'SUCCESS')])).toEqual([])
  })
  it('keeps colliding and untrusted codes as labels with independent internal node ids', () => {
    const nodes = [
      node('job-a', 'RUNNING'),
      node('job_a', 'PENDING'),
      node('x"] --> injected["', 'FAILED'),
    ]
    const graph = executionGraph(
      nodes,
      [{ fromNodeCode: 'job-a', toNodeCode: 'job_a' }],
      (n) => n.nodeCode,
    )
    expect(graph).toContain('n0 --> n1')
    expect(graph).toContain('class n0 running')
    expect(graph).toContain('class n2 failed')
    expect(graph).not.toContain('x"] --> injected["')
  })
  it('shows a running linked Job while preserving the Workflow node status', () => {
    const nodeWithRunningJob = {
      ...node('atomic-job', 'READY'),
      jobInstanceId: 42,
      jobInstanceStatus: 'RUNNING',
    }
    expect(executionNodeDisplayStatus(nodeWithRunningJob)).toBe('RUNNING')
    expect(executionTotals([nodeWithRunningJob])).toMatchObject({
      terminal: 0,
      active: 1,
      percentage: 0,
    })
    expect(
      executionGraph([nodeWithRunningJob], [], (value) => executionNodeDisplayStatus(value)),
    ).toContain('class n0 running')
    expect(nodeWithRunningJob.nodeStatus).toBe('READY')
  })
  it('counts terminal completion separately from success and includes pending nodes', () => {
    expect(
      executionTotals([
        node('a', 'SUCCESS'),
        node('b', 'FAILED'),
        node('c', 'SKIPPED'),
        node('d', 'PENDING'),
      ]),
    ).toEqual({ total: 4, terminal: 3, notExecuted: 0, succeeded: 1, active: 0, percentage: 75 })
  })
  it('closes nodes without an attempt separately from successful execution', () => {
    const totals = executionTotals([node('a', 'SUCCESS'), node('b', 'NOT_EXECUTED')])
    expect(totals).toMatchObject({
      total: 2,
      terminal: 2,
      succeeded: 1,
      notExecuted: 1,
      percentage: 100,
    })
    expect(executionGraph([node('b', 'NOT_EXECUTED')], [], (n) => n.nodeStatus)).toContain(
      'class n0 cancelled',
    )
  })
})
