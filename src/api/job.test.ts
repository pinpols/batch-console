import { describe, it, expect, vi, beforeEach } from 'vitest'
import { jobApi } from './job'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}))
vi.mock('./adapters', () => ({
  fetchAllPageItems: vi.fn(),
}))
vi.mock('./batchDays', () => ({
  launchBatchDayCatchUp: vi.fn(),
}))
vi.mock('./instance', () => ({
  instanceApi: {
    detail: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
    partitions: vi.fn(),
  },
}))
vi.mock('./queries/instances', () => ({
  queryJobInstances: vi.fn(),
}))

import { get, post, put, patch } from './client'
import { fetchAllPageItems } from './adapters'
import { launchBatchDayCatchUp } from './batchDays'

const mg = vi.mocked(get)
const mp = vi.mocked(post)
const mput = vi.mocked(put)
const mpatch = vi.mocked(patch)
const mall = vi.mocked(fetchAllPageItems)
const mbd = vi.mocked(launchBatchDayCatchUp)

describe('jobApi', () => {
  beforeEach(() => {
    mg.mockReset()
    mp.mockReset()
    mput.mockReset()
    mpatch.mockReset()
    mall.mockReset()
    mbd.mockReset()
  })

  it('createDefinition POST returns id', async () => {
    mp.mockResolvedValue(42)
    const id = await jobApi.createDefinition({
      tenantId: 'ta',
      jobCode: 'JOB_A',
      jobType: 'GENERAL',
      scheduleType: 'MANUAL',
    })
    expect(id).toBe(42)
    expect(mp).toHaveBeenCalledWith('/api/console/job-definitions', {
      tenantId: 'ta',
      jobCode: 'JOB_A',
      jobType: 'GENERAL',
      scheduleType: 'MANUAL',
    })
  })

  it('updateDefinition PUT with id in path', async () => {
    mput.mockResolvedValue(undefined)
    await jobApi.updateDefinition(7, { tenantId: 'ta', jobName: 'new' })
    expect(mput).toHaveBeenCalledWith('/api/console/job-definitions/7', {
      tenantId: 'ta',
      jobName: 'new',
    })
  })

  it('getDefinition GET with tenantId', async () => {
    mg.mockResolvedValue({})
    await jobApi.getDefinition(7, 'ta')
    expect(mg).toHaveBeenCalledWith('/api/console/job-definitions/7', { tenantId: 'ta' })
  })

  it('trigger POST with default bizDate (today YYYY-MM-DD) + MANUAL', async () => {
    mp.mockResolvedValue('ok')
    await jobApi.trigger('JOB_A', 'ta')
    expect(mp).toHaveBeenCalledWith('/api/console/jobs/trigger', {
      tenantId: 'ta',
      jobCode: 'JOB_A',
      bizDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      triggerType: 'MANUAL',
      payload: '{}',
    })
  })

  it('trigger with payload object → JSON stringified', async () => {
    mp.mockResolvedValue('ok')
    await jobApi.trigger('JOB_A', 'ta', { foo: 'bar' })
    const call = mp.mock.calls[0][1] as { payload: string }
    expect(call.payload).toBe('{"foo":"bar"}')
  })

  it('rerun POST with body passthrough', async () => {
    mp.mockResolvedValue('ok')
    const body = {
      tenantId: 'ta',
      jobCode: 'JOB_A',
      bizDate: '2026-05-21',
      instanceNo: 'inst-1',
      reason: 'retry',
    }
    await jobApi.rerun(body)
    expect(mp).toHaveBeenCalledWith('/api/console/jobs/rerun', body)
  })

  it('toggleEnabled resolves jobCode → id then PATCH', async () => {
    mall.mockResolvedValue([{ id: 99, jobCode: 'JOB_A' } as never])
    mpatch.mockResolvedValue(undefined)
    await jobApi.toggleEnabled('JOB_A', 'ta', true)
    expect(mall).toHaveBeenCalledWith('/api/console/queries/job-definitions', {
      tenantId: 'ta',
      jobCode: 'JOB_A',
    })
    expect(mpatch).toHaveBeenCalledWith('/api/console/job-definitions/99', {
      tenantId: 'ta',
      enabled: true,
    })
  })

  it('toggleEnabled throws when jobCode not found', async () => {
    mall.mockResolvedValue([{ id: 1, jobCode: 'OTHER' } as never])
    await expect(jobApi.toggleEnabled('JOB_X', 'ta', false)).rejects.toThrow(/JOB_X/)
  })

  it('batchToggle PATCH /batch', async () => {
    mpatch.mockResolvedValue({})
    await jobApi.batchToggle({ tenantId: 'ta', ids: [1, 2, 3], enabled: false })
    expect(mpatch).toHaveBeenCalledWith('/api/console/job-definitions/batch', {
      tenantId: 'ta',
      ids: [1, 2, 3],
      enabled: false,
    })
  })

  it('clone POST with newJobCode in body (BE @NotBlank)', async () => {
    mp.mockResolvedValue(101)
    await jobApi.clone(5, 'ta', 'JOB_CLONE')
    expect(mp).toHaveBeenCalledWith('/api/console/job-definitions/5/clone', {
      tenantId: 'ta',
      newJobCode: 'JOB_CLONE',
    })
  })

  it('copy POST with params (NOT body), per BE contract', async () => {
    mp.mockResolvedValue(101)
    await jobApi.copy(5, 'ta', 'JOB_COPY')
    expect(mp).toHaveBeenCalledWith('/api/console/job-definitions/5/copy', undefined, {
      params: { tenantId: 'ta', newJobCode: 'JOB_COPY' },
    })
  })

  it('exportBundle GET with tenantId + jobCode', async () => {
    mg.mockResolvedValue({})
    await jobApi.exportBundle('ta', 'JOB_A')
    expect(mg).toHaveBeenCalledWith('/api/console/jobs/bundle/export', {
      tenantId: 'ta',
      jobCode: 'JOB_A',
    })
  })

  it('importBundle POST', async () => {
    mp.mockResolvedValue({})
    const body = { tenantId: 'ta', bundle: { jobDefinitions: [] } }
    await jobApi.importBundle(body)
    expect(mp).toHaveBeenCalledWith('/api/console/jobs/bundle/import', body)
  })

  describe('listDefinitionsPaged', () => {
    it('passes pageNo + pageSize + optional jobCode/enabled', async () => {
      mg.mockResolvedValue({ items: [{ id: 1 } as never], total: 1, pageNo: 1, pageSize: 15 })
      const out = await jobApi.listDefinitionsPaged({
        tenantId: 'ta',
        pageNo: 1,
        pageSize: 15,
        jobCode: 'JOB_A',
        enabled: true,
      })
      expect(mg).toHaveBeenCalledWith('/api/console/queries/job-definitions', {
        tenantId: 'ta',
        pageNo: 1,
        pageSize: 15,
        jobCode: 'JOB_A',
        enabled: true,
      })
      expect(out).toEqual({
        records: [{ id: 1 }],
        total: 1,
        page: 1,
        pageSize: 15,
      })
    })

    it('omits null enabled / undefined jobCode', async () => {
      mg.mockResolvedValue({ items: [], total: 0, pageNo: 2, pageSize: 30 })
      await jobApi.listDefinitionsPaged({ tenantId: 'ta', pageNo: 2, pageSize: 30 })
      expect(mg).toHaveBeenCalledWith('/api/console/queries/job-definitions', {
        tenantId: 'ta',
        pageNo: 2,
        pageSize: 30,
      })
    })

    it('null items → empty records, null total → 0', async () => {
      mg.mockResolvedValue({} as never)
      const out = await jobApi.listDefinitionsPaged({ tenantId: 'ta', pageNo: 1, pageSize: 10 })
      expect(out.records).toEqual([])
      expect(out.total).toBe(0)
      expect(out.page).toBe(1)
      expect(out.pageSize).toBe(10)
    })
  })

  it('batchDayCatchUp delegates to launchBatchDayCatchUp', async () => {
    mbd.mockResolvedValue({} as never)
    await jobApi.batchDayCatchUp('2026-05-21', { tenantId: 'ta' } as never)
    expect(mbd).toHaveBeenCalledWith('2026-05-21', { tenantId: 'ta' })
  })
})
