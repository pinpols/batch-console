import { beforeEach, describe, expect, it, vi } from 'vitest'
import { instanceApi } from '@/api/instance'
import { queryJobStepInstancePage } from '@/api/jobStepInstances'
import { queryPartitionsPaged } from '@/api/queries/partitions'
import { loadWorkflowNodeExecutionDetails } from './workflowNodeExecution'

vi.mock('@/api/instance', () => ({
  instanceApi: { detail: vi.fn() },
}))
vi.mock('@/api/jobStepInstances', () => ({ queryJobStepInstancePage: vi.fn() }))
vi.mock('@/api/queries/partitions', () => ({ queryPartitionsPaged: vi.fn() }))

describe('loadWorkflowNodeExecutionDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads a bounded first page of partitions and pipeline stages for the linked instance', async () => {
    const instance = { id: 42, jobCode: 'IMPORT_A', instanceStatus: 'RUNNING' }
    const partition = {
      id: 3,
      tenantId: 'tenant-a',
      jobInstanceId: 42,
      partitionNo: 1,
      partitionKey: 'partition-1',
      partitionStatus: 'RUNNING',
      workerGroup: 'default',
      workerCode: 'worker-import',
      retryCount: 0,
      businessKey: 'business-1',
      leaseExpireAt: '2026-10-16T00:01:00Z',
      startedAt: '2026-10-16T00:00:00Z',
      finishedAt: '',
    }
    const step = { id: 8, stepCode: 'PARSE', relatedPipelineInstanceId: 13 }
    vi.mocked(instanceApi.detail).mockResolvedValue(instance as never)
    vi.mocked(queryPartitionsPaged).mockResolvedValue({
      records: [partition],
      total: 27,
      page: 1,
      pageSize: 20,
    })
    vi.mocked(queryJobStepInstancePage).mockResolvedValue({ items: [step], total: 31 } as never)

    await expect(loadWorkflowNodeExecutionDetails(42, 'tenant-a')).resolves.toEqual({
      instance,
      partitions: [partition],
      partitionTotal: 27,
      steps: [step],
      stepTotal: 31,
    })
    expect(instanceApi.detail).toHaveBeenCalledWith(42, 'tenant-a')
    expect(queryPartitionsPaged).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      jobInstanceId: 42,
      page: 1,
      pageSize: 20,
    })
    expect(queryJobStepInstancePage).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      jobInstanceId: 42,
      pageNo: 1,
      pageSize: 20,
    })
  })

  it('propagates read failures instead of presenting partial details as complete', async () => {
    vi.mocked(instanceApi.detail).mockRejectedValue(new Error('not found'))
    vi.mocked(queryPartitionsPaged).mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
    vi.mocked(queryJobStepInstancePage).mockResolvedValue({ items: [], total: 0 } as never)

    await expect(loadWorkflowNodeExecutionDetails(404, 'tenant-a')).rejects.toThrow('not found')
  })
})
