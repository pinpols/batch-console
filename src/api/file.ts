import { apiClient, get, post, del } from '@/api/client'
import { fetchAllPageItems, toPageResult } from '@/api/adapters'
import { readStoredTenantId } from '@/api/interceptors'
import type { PageResponse, PageResult } from '@/types'
import type {
  ConsoleAuditLogResponse,
  ConsoleFileArrivalGroupResponse,
  ConsoleFileOperationResponse,
  ConsoleFileRecordResponse,
} from '@/types/console-api'

export interface FileQuery {
  tenantId?: string
  /** exact match */
  fileStatus?: string
  /** partial match */
  bizType?: string
  /** partial match */
  fileName?: string
  /** exact match */
  traceId?: string
  /** exact match */
  fileId?: string
  /** ISO date range start */
  startDate?: string
  /** ISO date range end */
  endDate?: string
  page: number
  pageSize: number
}

function filterFiles(
  items: ConsoleFileRecordResponse[],
  q: FileQuery,
): ConsoleFileRecordResponse[] {
  let rows = [...items]
  if (q.fileStatus) rows = rows.filter((r) => r.fileStatus === q.fileStatus)
  if (q.bizType) rows = rows.filter((r) => r.bizType?.includes(q.bizType!))
  if (q.fileName) rows = rows.filter((r) => r.fileName?.includes(q.fileName!))
  if (q.traceId) rows = rows.filter((r) => r.traceId?.includes(q.traceId!))
  if (q.fileId) rows = rows.filter((r) => String(r.id).includes(q.fileId!))
  if (q.startDate) rows = rows.filter((r) => String(r.bizDate ?? '') >= q.startDate!)
  if (q.endDate) rows = rows.filter((r) => String(r.bizDate ?? '') <= q.endDate!)
  return rows
}

export const fileApi = {
  list: async (query: FileQuery) => {
    const hasFilter = !!(
      query.fileStatus ||
      query.bizType ||
      query.fileName ||
      query.traceId ||
      query.fileId ||
      query.startDate ||
      query.endDate
    )
    if (!hasFilter) {
      const pr = await get<PageResponse<ConsoleFileRecordResponse>>('/api/console/queries/files', {
        tenantId: query.tenantId,
        pageNo: query.page,
        pageSize: query.pageSize,
      })
      return {
        records: (pr.items ?? []) as ConsoleFileRecordResponse[],
        total: pr.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      }
    }
    // 将过滤参数传给后端（后端支持时减少传输量，客户端 filterFiles 仍做兜底）
    const items = await fetchAllPageItems<ConsoleFileRecordResponse>('/api/console/queries/files', {
      tenantId: query.tenantId,
      ...(query.fileStatus ? { fileStatus: query.fileStatus } : {}),
      ...(query.bizType ? { bizType: query.bizType } : {}),
      ...(query.fileName ? { fileName: query.fileName } : {}),
      ...(query.traceId ? { traceId: query.traceId } : {}),
      ...(query.fileId ? { fileId: query.fileId } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
    })
    return toPageResult(filterFiles(items, query), query.page, query.pageSize)
  },

  detail: (fileId: number, tenantId = readStoredTenantId()) =>
    get<Record<string, unknown>>(`/api/console/queries/files/${fileId}`, { tenantId }),

  audit: async (fileId: number, tenantId = readStoredTenantId()) => {
    // 传入 fileId 让后端过滤（不支持时忽略，客户端仍做 filter 兜底）
    const rows = await fetchAllPageItems<ConsoleAuditLogResponse>('/api/console/queries/audits', {
      tenantId,
      fileId,
    })
    return rows
      .filter((row) => row.fileId === fileId)
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  },

  listArrivalGroups: (tenantId: string) =>
    fetchAllPageItems<ConsoleFileArrivalGroupResponse>('/api/console/queries/file-arrival-groups', {
      tenantId,
    }),

  confirmArrival: (fileGroupCode: string, tenantId: string) =>
    post('/api/console/files/arrival-groups/action', {
      tenantId,
      fileGroupCode,
      action: 'CONFIRM',
    }),

  /** POST /api/console/files/presign-upload */
  presignUpload: (tenantId: string, channelCode: string, fileName: string) =>
    post<unknown>('/api/console/files/presign-upload', undefined, {
      params: { tenantId, channelCode, fileName },
    }),

  /** POST /api/console/files/{fileId}/confirm-arrival */
  confirmFileArrival: (fileId: number, tenantId: string) =>
    post<unknown>(`/api/console/files/${fileId}/confirm-arrival`, undefined, {
      params: { tenantId },
    }),

  /** GET /api/console/files/{fileId}/errors/export — CSV download */
  exportErrors: (fileId: number, tenantId: string, errorStage?: string) =>
    apiClient.get(`/api/console/files/${fileId}/errors/export`, {
      params: { tenantId, ...(errorStage ? { errorStage } : {}) },
      responseType: 'blob',
    }),

  /** GET /api/console/files/{fileId}/download */
  download: (fileId: number, tenantId: string, approvalId?: number) =>
    apiClient.get(`/api/console/files/${fileId}/download`, {
      params: { tenantId, ...(approvalId != null ? { approvalId } : {}) },
      responseType: 'blob',
    }),

  /** POST /api/console/files/presign-download */
  presignDownload: (body: { tenantId: string; fileId: number; reason?: string }) =>
    post<unknown>('/api/console/files/presign-download', body),

  /** POST /api/console/files/archive */
  archive: (body: { tenantId: string; fileId: number; reason?: string }) =>
    post<ConsoleFileOperationResponse>('/api/console/files/archive', body),

  /** DELETE /api/console/files/{fileId} */
  delete: (fileId: number, tenantId: string, reason?: string) =>
    del<ConsoleFileOperationResponse>(`/api/console/files/${fileId}`, {
      params: { tenantId, ...(reason ? { reason } : {}) },
    }),

  /** POST /api/console/files/redispatch */
  redispatch: (body: { tenantId: string; fileId: number; reason?: string }) =>
    post<ConsoleFileOperationResponse>('/api/console/files/redispatch', body),
}
