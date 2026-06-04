import { post } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type { ConsoleApprovalCommandResponse } from '@/types/console-api'

/** OpenAPI data 为 PageResponse，聚合供审批中心列表与批量选择 */
export function queryApprovals(tenantId: string) {
  return fetchAllPageItems<ConsoleApprovalCommandResponse>('/api/console/queries/approvals', {
    tenantId,
  })
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
