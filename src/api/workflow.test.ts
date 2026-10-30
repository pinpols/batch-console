import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('./adapters', () => ({ fetchAllPageItems: vi.fn() }))

import { get, patch, post, put } from './client'
import { workflowApi } from './workflow'

const mockedGet = vi.mocked(get)
const mockedPatch = vi.mocked(patch)
const mockedPut = vi.mocked(put)
const mockedPost = vi.mocked(post)

describe('workflowApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPatch.mockReset()
    mockedPut.mockReset()
    mockedPost.mockReset()
  })

  it('批量项目重试沿用显式幂等键和冻结租户', async () => {
    mockedPost.mockResolvedValue('801')
    const body = { tenantId: 'ta', bizDate: '2026-10-24', triggerType: 'MANUAL' }

    await workflowApi.trigger(7, body, 'stable-item-key')

    expect(mockedPost).toHaveBeenCalledWith('/api/console/workflow-definitions/7/trigger', body, {
      headers: { 'Idempotency-Key': 'stable-item-key', 'X-Tenant-Id': 'ta' },
    })
  })

  it('结果核对只读取原租户目标及幂等键，不重新发起', async () => {
    mockedGet.mockResolvedValue({ requestId: 'req-1', requestStatus: 'WAITING' })

    await workflowApi.triggerStatus(7, 'ta', 'stable-item-key')

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/workflow-definitions/7/trigger-status',
      { tenantId: 'ta' },
      { headers: { 'Idempotency-Key': 'stable-item-key', 'X-Tenant-Id': 'ta' } },
    )
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('lists definitions with backend filters and pagination', async () => {
    mockedGet.mockResolvedValue({ items: [{ id: 7 }], total: 21 })

    const result = await workflowApi.listDefinitions({
      tenantId: 'ta',
      workflowCode: 'daily',
      workflowName: 'Daily',
      workflowType: 'DAG',
      enabled: false,
      version: 2,
      page: 2,
      pageSize: 15,
    })

    expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/workflow-definitions', {
      tenantId: 'ta',
      pageNo: 2,
      pageSize: 15,
      workflowCode: 'daily',
      workflowName: 'Daily',
      workflowType: 'DAG',
      enabled: false,
      version: 2,
    })
    expect(result).toEqual({ records: [{ id: 7 }], total: 21, page: 2, pageSize: 15 })
  })

  it('toggles scheduled fires independently from workflow enabled state', async () => {
    mockedPatch.mockResolvedValue(undefined)

    await workflowApi.toggleSchedule(7, 'tenant-a', false)

    expect(mockedPatch).toHaveBeenCalledWith(
      '/api/console/workflow-definitions/7/schedule-enabled',
      { tenantId: 'tenant-a', enabled: false },
    )
  })

  it('updates schedule settings through the schedule-only endpoint', async () => {
    const detail = { id: 7, version: 3 }
    mockedPut.mockResolvedValue(detail)

    await workflowApi.updateSchedule(7, {
      tenantId: 'tenant-a',
      expectedVersion: 3,
      scheduleType: 'CRON',
      scheduleExpr: '0 0 2 * * *',
      timezone: 'Asia/Shanghai',
      triggerMode: 'SCHEDULED',
      calendarCode: null,
      dependsOnJobCode: null,
    })

    expect(mockedPut).toHaveBeenCalledWith(
      '/api/console/workflow-definitions/7/schedule',
      expect.objectContaining({ expectedVersion: 3, scheduleType: 'CRON' }),
    )
  })
})
