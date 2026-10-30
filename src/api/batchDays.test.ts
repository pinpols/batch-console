import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, post } from './client'
import {
  previewBatchDayCatchup,
  queryHistoricalBatchDayGaps,
  operateBatchDay,
  controlBatchDayCatchup,
  getBatchDayCatchUpRequestStatus,
  launchBatchDayCatchUp,
  reconcileBatchDayCatchUpRequest,
  continueBatchDayCatchUpRequest,
} from './batchDays'
vi.mock('./client', () => ({ get: vi.fn(), post: vi.fn() }))
describe('批次日治理契约', () => {
  beforeEach(() => vi.clearAllMocks())
  it('按原请求键只读批量日结果，未观察到记录时不发起写入', async () => {
    await getBatchDayCatchUpRequestStatus('tenant-a', 'original-key')
    expect(get).toHaveBeenCalledWith(
      '/api/console/jobs/batch-days/catchup/requests/status',
      { tenantId: 'tenant-a' },
      { headers: { 'Idempotency-Key': 'original-key' } },
    )
    expect(post).not.toHaveBeenCalled()
  })
  it('对账保留原请求键并为操作生成独立传输键', async () => {
    await reconcileBatchDayCatchUpRequest('tenant-a', 'original-key', 'JOB_A')
    expect(post).toHaveBeenCalledWith(
      '/api/console/jobs/batch-days/catchup/requests/reconcile',
      { tenantId: 'tenant-a', jobCode: 'JOB_A' },
      {
        headers: {
          'Idempotency-Key': expect.any(String),
          'X-Original-Idempotency-Key': 'original-key',
        },
      },
    )
    expect(vi.mocked(post).mock.calls[0][2]?.headers?.['Idempotency-Key']).not.toBe('original-key')
  })
  it('接续使用原请求键并独立生成操作键', async () => {
    await continueBatchDayCatchUpRequest('tenant-a', 'original-key')
    expect(post).toHaveBeenCalledWith(
      '/api/console/jobs/batch-days/catchup/requests/continue',
      { tenantId: 'tenant-a' },
      {
        headers: {
          'Idempotency-Key': expect.any(String),
          'X-Original-Idempotency-Key': 'original-key',
        },
      },
    )
    expect(vi.mocked(post).mock.calls[0][2]?.headers?.['Idempotency-Key']).not.toBe('original-key')
  })
  it('批量日提交可由调用方显式保留原请求键', async () => {
    const request = { tenantId: 'tenant-a', calendarCode: 'CAL' }
    await launchBatchDayCatchUp('2026-10-29', request, 'original-key')
    expect(post).toHaveBeenCalledWith('/api/console/jobs/batch-days/2026-10-29/catchup', request, {
      headers: { 'Idempotency-Key': 'original-key' },
    })
  })
  it('预览与缺口查询限定租户、日历和完整日期范围', async () => {
    await previewBatchDayCatchup('tenant-a', 'CAL')
    await queryHistoricalBatchDayGaps('tenant-a', 'CAL', '2026-10-01', '2026-10-05')
    expect(get).toHaveBeenNthCalledWith(1, '/api/console/batch-days/catch-up-preview', {
      tenantId: 'tenant-a',
      calendarCode: 'CAL',
    })
    expect(get).toHaveBeenNthCalledWith(2, '/api/console/batch-days/historical-gap-candidates', {
      tenantId: 'tenant-a',
      calendarCode: 'CAL',
      fromDate: '2026-10-01',
      throughDate: '2026-10-05',
    })
  })
  it('两类写操作显式复用原幂等键，不提交伪造操作者', async () => {
    const day = {
      tenantId: 'tenant-a',
      calendarCode: 'CAL',
      bizDate: '2026-10-01',
      action: 'FREEZE' as const,
      reason: 'review',
    }
    const catchup = {
      tenantId: 'tenant-a',
      calendarCode: 'CAL',
      action: 'PAUSE' as const,
      reason: 'review',
    }
    await operateBatchDay(day, 'stable-day')
    await controlBatchDayCatchup(catchup, 'stable-catchup')
    expect(post).toHaveBeenNthCalledWith(1, '/api/console/batch-days/operate', day, {
      headers: { 'Idempotency-Key': 'stable-day' },
    })
    expect(post).toHaveBeenNthCalledWith(2, '/api/console/batch-days/catch-up-control', catchup, {
      headers: { 'Idempotency-Key': 'stable-catchup' },
    })
  })
})
