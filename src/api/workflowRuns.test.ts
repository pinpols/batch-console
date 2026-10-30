import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getWorkflowExecutionProgress,
  pauseWorkflowRun,
  resumeWorkflowRun,
  previewWholeWorkflowReplay,
  submitWholeWorkflowReplay,
} from './workflowRuns'

vi.mock('./client', () => ({
  post: vi.fn(),
  get: vi.fn(),
}))

import { get, post } from './client'

const mockedPost = vi.mocked(post)

describe('whole Workflow replay API', () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it('sends the preview request through the Console route', async () => {
    const request = { tenantId: 'tenant-a', workflowRunId: 71, reason: 'approved plan' }
    const preview = {
      operationKey: 'operation-key',
      previewToken: 'preview-token',
      nodes: [],
      edges: [],
    }
    mockedPost.mockResolvedValue(preview)

    await expect(previewWholeWorkflowReplay(request)).resolves.toEqual(preview)
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/jobs/workflow-run/replay-preview',
      request,
    )
  })

  it('pins submission retries to the preview operation key', async () => {
    const request = {
      tenantId: 'tenant-a',
      workflowRunId: 71,
      reason: 'approved plan',
      operationKey: 'operation-key',
      previewToken: 'preview-token',
    }
    const submission = { replayOperationId: 901, approvalNo: 'APR-901' }
    mockedPost.mockResolvedValue(submission)

    await expect(submitWholeWorkflowReplay(request, 'operation-key')).resolves.toEqual(submission)
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/jobs/workflow-run/replay-operations',
      request,
      { headers: { 'Idempotency-Key': 'operation-key' } },
    )
  })
})

describe('Workflow execution API', () => {
  it('puts tenant identity in the snapshot query without nesting params', async () => {
    vi.mocked(get).mockReset()
    await getWorkflowExecutionProgress(7, 'tenant-a')
    expect(get).toHaveBeenCalledWith(
      '/api/console/workflow-runs/7/execution-progress',
      { tenantId: 'tenant-a' },
      { _silent: true },
    )
  })
  it('sends pause and resume to execution lifecycle routes with tenant identity', async () => {
    mockedPost.mockReset()
    await pauseWorkflowRun(7, 'tenant-a')
    await resumeWorkflowRun(7, 'tenant-a')
    expect(post).toHaveBeenNthCalledWith(1, '/api/console/workflow-runs/7/pause', undefined, {
      params: { tenantId: 'tenant-a' },
    })
    expect(post).toHaveBeenNthCalledWith(2, '/api/console/workflow-runs/7/resume', undefined, {
      params: { tenantId: 'tenant-a' },
    })
  })
})
