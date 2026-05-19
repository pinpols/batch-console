import { get } from '@/api/client'

/**
 * 通用控制台用户操作审计 API client。
 *
 * 后端 `/api/console/queries/operation-audits` 是**服务端分页**(不像 /audits 是
 * client-side paginated all-items),所以这里**不**复用 fetchAllPageItems,直接传
 * pageNo/pageSize 给后端。
 */
export interface OperationAuditResponse {
  id: number
  tenantId: string
  aggregateType: string
  aggregateId: string
  action: string
  operatorId: string | null
  operatorRole: string | null
  result: 'SUCCESS' | 'FAILED'
  errorCode: string | null
  errorMessage: string | null
  params: string | null
  traceId: string | null
  requestId: string | null
  ipHash: string | null
  uaHash: string | null
  eventVersion: number
  createdAt: string
}

export interface OperationAuditQuery {
  tenantId?: string
  aggregateType?: string
  aggregateId?: string
  action?: string
  operatorId?: string
  result?: 'SUCCESS' | 'FAILED' | ''
  traceId?: string
  startTime?: string
  endTime?: string
  pageNo: number
  pageSize: number
}

export interface OperationAuditPage {
  total: number
  pageNo: number
  pageSize: number
  items: OperationAuditResponse[]
}

export async function queryOperationAudits(q: OperationAuditQuery): Promise<OperationAuditPage> {
  return get<OperationAuditPage>('/api/console/queries/operation-audits', { params: q })
}
