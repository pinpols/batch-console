import { get, post } from '@/api/client'
import { createIdempotencyKey } from '@/utils/idempotency'
import type { PageResponse } from '@/types'
import type {
  BatchDayCatchUpRequest,
  ConsoleBatchDayCatchUpResponse,
  ConsoleBatchDayResponse,
  ConsoleBatchDayWindowResponse,
} from '@/types/console-api'

export interface BatchDayListParams {
  tenantId: string
  calendarCode: string
  from?: string
  to?: string
  pageNo: number
  pageSize: number
}

/** GET /api/console/queries/batch-days — 分页，data 为 PageResponse */
export function queryBatchDays(params: BatchDayListParams) {
  return get<PageResponse<ConsoleBatchDayResponse>>('/api/console/queries/batch-days', {
    tenantId: params.tenantId,
    calendarCode: params.calendarCode,
    from: params.from,
    to: params.to,
    pageNo: params.pageNo,
    pageSize: params.pageSize,
  })
}

/** GET /api/console/queries/batch-days/{bizDate}/window */
export function queryBatchDayWindow(tenantId: string, calendarCode: string, bizDate: string) {
  return get<ConsoleBatchDayWindowResponse>(
    `/api/console/queries/batch-days/${encodeURIComponent(bizDate)}/window`,
    { tenantId, calendarCode },
  )
}

/** POST /api/console/jobs/batch-days/{bizDate}/catchup */
export function launchBatchDayCatchUp(
  bizDate: string,
  body: BatchDayCatchUpRequest,
  idempotencyKey?: string,
) {
  return post<ConsoleBatchDayCatchUpResponse>(
    `/api/console/jobs/batch-days/${encodeURIComponent(bizDate)}/catchup`,
    body,
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
  )
}

/** 按原请求键只读批次状态；未找到不代表可以换键重发。 */
export function getBatchDayCatchUpRequestStatus(tenantId: string, idempotencyKey: string) {
  return get<
    import('@/types/api.generated').components['schemas']['BatchDayCatchUpRequestStatusResponse']
  >(
    '/api/console/jobs/batch-days/catchup/requests/status',
    { tenantId },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
}

/** 为尚未建档的原键设置围栏；已存在批次时只返回其当前状态。 */
export function abandonUnpreparedBatchDayCatchUp(
  tenantId: string,
  originalKey: string,
  bizDate: string,
  calendarCode: string,
) {
  return post<
    import('@/types/api.generated').components['schemas']['BatchDayCatchUpRequestStatusResponse']
  >(
    '/api/console/jobs/batch-days/catchup/requests/abandon',
    { tenantId, bizDate, calendarCode },
    {
      headers: {
        'Idempotency-Key': createIdempotencyKey(),
        'X-Original-Idempotency-Key': originalKey,
      },
    },
  )
}

/** 核对原审批或触发回执；传输键与原批次请求键分别维护。 */
export function reconcileBatchDayCatchUpRequest(
  tenantId: string,
  originalKey: string,
  jobCode: string,
) {
  return post<
    import('@/types/api.generated').components['schemas']['BatchDayCatchUpRequestStatusResponse']
  >(
    '/api/console/jobs/batch-days/catchup/requests/reconcile',
    { tenantId, jobCode },
    {
      headers: {
        'Idempotency-Key': createIdempotencyKey(),
        'X-Original-Idempotency-Key': originalKey,
      },
    },
  )
}

/** 以原冻结请求接续尚未提交的项目。 */
export function continueBatchDayCatchUpRequest(tenantId: string, originalKey: string) {
  return post<
    import('@/types/api.generated').components['schemas']['BatchDayCatchUpRequestStatusResponse']
  >(
    '/api/console/jobs/batch-days/catchup/requests/continue',
    { tenantId },
    {
      headers: {
        'Idempotency-Key': createIdempotencyKey(),
        'X-Original-Idempotency-Key': originalKey,
      },
    },
  )
}

export type BatchDayCatchupPreview =
  import('@/types/api.generated').components['schemas']['ConsoleBatchDayCatchupPreviewResponse']
export type BatchDayHistoricalGaps =
  import('@/types/api.generated').components['schemas']['ConsoleBatchDayHistoricalGapInventoryResponse']
export type BatchDayOperateRequest =
  import('@/types/api.generated').components['schemas']['BatchDayOperateRequest']
export type BatchDayCatchupControlRequest =
  import('@/types/api.generated').components['schemas']['BatchDayCatchupControlRequest']
export type BatchDayOperateResponse =
  import('@/types/api.generated').components['schemas']['BatchDayOperateResponse']

export function previewBatchDayCatchup(tenantId: string, calendarCode: string) {
  return get<BatchDayCatchupPreview>('/api/console/batch-days/catch-up-preview', {
    tenantId,
    calendarCode,
  })
}
export function queryHistoricalBatchDayGaps(
  tenantId: string,
  calendarCode: string,
  fromDate: string,
  throughDate: string,
) {
  return get<BatchDayHistoricalGaps>('/api/console/batch-days/historical-gap-candidates', {
    tenantId,
    calendarCode,
    fromDate,
    throughDate,
  })
}
export function operateBatchDay(body: BatchDayOperateRequest, idempotencyKey: string) {
  return post<BatchDayOperateResponse>('/api/console/batch-days/operate', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}
export function controlBatchDayCatchup(
  body: BatchDayCatchupControlRequest,
  idempotencyKey: string,
) {
  return post<BatchDayCatchupPreview>('/api/console/batch-days/catch-up-control', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}
