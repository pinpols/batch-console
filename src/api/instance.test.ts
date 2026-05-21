import { describe, it, expect, vi, beforeEach } from 'vitest'
import { instanceApi } from './instance'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))
vi.mock('./adapters', () => ({
  fetchAllPageItems: vi.fn(),
}))
vi.mock('./queries/instances', () => ({
  queryJobInstances: vi.fn(),
}))

import { get, post } from './client'
import { fetchAllPageItems } from './adapters'
import { queryJobInstances } from './queries/instances'

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)
const mockedAll = vi.mocked(fetchAllPageItems)
const mockedQ = vi.mocked(queryJobInstances)

describe('instanceApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    mockedAll.mockReset()
    mockedQ.mockReset()
  })

  it('list delegates to queryJobInstances', async () => {
    mockedQ.mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 15 })
    await instanceApi.list({ tenantId: 'ta', page: 1, pageSize: 15 })
    expect(mockedQ).toHaveBeenCalledWith({ tenantId: 'ta', page: 1, pageSize: 15 })
  })

  it('detail GET with tenantId query', async () => {
    mockedGet.mockResolvedValue({})
    await instanceApi.detail(42, 'ta')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/instances/42', { tenantId: 'ta' })
  })

  it('retry POST with rerun body', async () => {
    mockedPost.mockResolvedValue('ok')
    await instanceApi.retry('inst-1', 'ta', 'JOB_A', '2026-05-21')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/jobs/rerun', {
      tenantId: 'ta',
      targetInstanceNo: 'inst-1',
      jobCode: 'JOB_A',
      bizDate: '2026-05-21',
      reason: 'console rerun',
    })
  })

  it('cancel POST with tenantId in params', async () => {
    mockedPost.mockResolvedValue('ok')
    await instanceApi.cancel(42, 'ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/instances/42/cancel', undefined, {
      params: { tenantId: 'ta' },
    })
  })

  it('terminate POST', async () => {
    mockedPost.mockResolvedValue('ok')
    await instanceApi.terminate(42, 'ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/instances/42/terminate', undefined, {
      params: { tenantId: 'ta' },
    })
  })

  it('partitions delegates to fetchAllPageItems', async () => {
    mockedAll.mockResolvedValue([])
    await instanceApi.partitions(42, 'ta')
    expect(mockedAll).toHaveBeenCalledWith('/api/console/queries/job-step-instances', {
      tenantId: 'ta',
      jobInstanceId: 42,
    })
  })

  it('batchStatus GET with instanceNos array', async () => {
    mockedGet.mockResolvedValue([])
    await instanceApi.batchStatus('ta', ['n1', 'n2'])
    expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/instances/batch-status', {
      tenantId: 'ta',
      instanceNos: ['n1', 'n2'],
    })
  })

  it('cancelPartition POST', async () => {
    mockedPost.mockResolvedValue('ok')
    await instanceApi.cancelPartition(7, 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/instances/partitions/7/cancel',
      undefined,
      {
        params: { tenantId: 'ta' },
      },
    )
  })

  it('retryPartition POST', async () => {
    mockedPost.mockResolvedValue('ok')
    await instanceApi.retryPartition(7, 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/instances/partitions/7/retry',
      undefined,
      {
        params: { tenantId: 'ta' },
      },
    )
  })

  describe('workflowRuns', () => {
    it('passes pagination + optional filters when set', async () => {
      mockedGet.mockResolvedValue({ items: [], total: 0 })
      await instanceApi.workflowRuns({
        tenantId: 'ta',
        workflowDefinitionId: 5,
        runStatus: ' RUNNING ',
        traceId: 'trace-x',
        page: 2,
        pageSize: 20,
      })
      expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/workflow-runs', {
        tenantId: 'ta',
        pageNo: 2,
        pageSize: 20,
        workflowDefinitionId: 5,
        runStatus: 'RUNNING',
        traceId: 'trace-x',
      })
    })

    it('omits empty optional filters (trim + blank guard)', async () => {
      mockedGet.mockResolvedValue({ items: [], total: 0 })
      await instanceApi.workflowRuns({
        tenantId: 'ta',
        runStatus: '   ',
        traceId: '',
        page: 1,
        pageSize: 10,
      })
      expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/workflow-runs', {
        tenantId: 'ta',
        pageNo: 1,
        pageSize: 10,
      })
    })

    it('returns PageResult shape (records/total/page/pageSize)', async () => {
      mockedGet.mockResolvedValue({
        items: [{ id: 1 } as never],
        total: 1,
      })
      const out = await instanceApi.workflowRuns({ tenantId: 'ta', page: 1, pageSize: 15 })
      expect(out).toEqual({
        records: [{ id: 1 }],
        total: 1,
        page: 1,
        pageSize: 15,
      })
    })

    it('null items fallback to empty array', async () => {
      mockedGet.mockResolvedValue({ items: null, total: undefined } as never)
      const out = await instanceApi.workflowRuns({ tenantId: 'ta', page: 1, pageSize: 10 })
      expect(out.records).toEqual([])
      expect(out.total).toBe(0)
    })
  })
})
