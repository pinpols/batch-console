import { get, post } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type { PageResponse } from '@/types'
import type {
  ConsoleApprovalCommandResponse,
  ConsolePendingCatchUpResponse,
} from '@/types/console-api'

/**
 * @deprecated 端上全量聚合(4000 截断隐患)。审批中心列表已迁 queryApprovalsPage 服务端分页;
 *             仅 SelfServicePanel / MApprovals 等小数据量场景过渡保留。
 */
export function queryApprovals(tenantId: string) {
  return fetchAllPageItems<ConsoleApprovalCommandResponse>('/api/console/queries/approvals', {
    tenantId,
  })
}

export interface ApprovalQueryFilters {
  /** 审批状态(approvalStatus enum)精确过滤 */
  approvalStatus?: string
  /** 审批类型(approvalType enum)精确过滤 */
  approvalType?: string
  /** 动作类型精确过滤 */
  actionType?: string
  /** 申请人精确过滤(?requester=me 入口) */
  requesterId?: string
  /** 大小写不敏感模糊匹配 approvalNo/requesterId/targetType/targetId 任一 */
  keyword?: string
}

/** 服务端分页查询审批指令(P5:替代 queryApprovals 端上全量聚合)。 */
export function queryApprovalsPage(
  tenantId: string,
  pageNo: number,
  pageSize: number,
  filters?: ApprovalQueryFilters,
): Promise<PageResponse<ConsoleApprovalCommandResponse>> {
  return get<PageResponse<ConsoleApprovalCommandResponse>>('/api/console/queries/approvals', {
    tenantId,
    pageNo,
    pageSize,
    ...(filters?.approvalStatus ? { approvalStatus: filters.approvalStatus } : {}),
    ...(filters?.approvalType ? { approvalType: filters.approvalType } : {}),
    ...(filters?.actionType ? { actionType: filters.actionType } : {}),
    ...(filters?.requesterId ? { requesterId: filters.requesterId } : {}),
    ...(filters?.keyword ? { keyword: filters.keyword } : {}),
  })
}

export interface CatchUpQueryFilters {
  /** 业务日期精确过滤(ISO yyyy-MM-dd) */
  bizDate?: string
  /** 大小写不敏感模糊匹配 requestId/jobCode/traceId 任一 */
  keyword?: string
  /** Job 编码精确过滤 */
  jobCode?: string
  /** 调度请求 ID 精确过滤 */
  requestId?: string
}

/** 服务端分页查询 catch-up 待审列表(P5:替代端上全量聚合)。 */
export function queryCatchUpApprovalsPage(
  tenantId: string,
  pageNo: number,
  pageSize: number,
  filters?: CatchUpQueryFilters,
): Promise<PageResponse<ConsolePendingCatchUpResponse>> {
  return get<PageResponse<ConsolePendingCatchUpResponse>>(
    '/api/console/queries/catch-up-approvals',
    {
      tenantId,
      pageNo,
      pageSize,
      ...(filters?.bizDate ? { bizDate: filters.bizDate } : {}),
      ...(filters?.keyword ? { keyword: filters.keyword } : {}),
      ...(filters?.jobCode ? { jobCode: filters.jobCode } : {}),
      ...(filters?.requestId ? { requestId: filters.requestId } : {}),
    },
  )
}

export function approveOne(
  approvalNo: string,
  // compensationType:补偿类审批(SELF_SERVICE / COMPENSATION)BE 执行时必填,
  // 取自审批单 payloadJson;漏传会被拒为 400「必须指定补偿类型」。
  body: { tenantId: string; operatorId?: string; reason?: string; compensationType?: string },
) {
  return post<string>(`/api/console/approvals/${encodeURIComponent(approvalNo)}/approve`, body)
}

export function rejectOne(
  approvalNo: string,
  body: { tenantId: string; operatorId?: string; reason?: string },
) {
  return post<string>(`/api/console/approvals/${encodeURIComponent(approvalNo)}/reject`, body)
}

export function batchApprove(body: {
  tenantId: string
  approvalNos: string[]
  operatorId?: string
  reason?: string
}) {
  return post<{ approvalNo: string; success: boolean; message: string }[]>(
    '/api/console/approvals/batch-approve',
    body,
  )
}

export function batchReject(body: {
  tenantId: string
  approvalNos: string[]
  operatorId?: string
  reason?: string
}) {
  return post<{ approvalNo: string; success: boolean; message: string }[]>(
    '/api/console/approvals/batch-reject',
    body,
  )
}
