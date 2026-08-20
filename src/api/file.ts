import { apiClient, get, post, del } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import { readStoredTenantId } from '@/api/interceptors'
import type { PageResponse, PageResult } from '@/types'
import type {
  ConsoleAuditLogResponse,
  ConsoleFileArrivalGroupResponse,
  ConsoleFileRecordDetailResponse,
  ConsoleFileOperationResponse,
  ConsoleFileRecordResponse,
  ConsoleFileSummaryResponse,
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

export const fileApi = {
  list: async (query: FileQuery) => {
    // 全字段过滤后端原生支持（FileStatus/BizType/FileName/TraceId/FileId/Start/EndDate
    // 均已在 console-api.openapi.yaml 的 /queries/files parameters 中声明），
    // 直接走服务端分页 + 过滤，避免 fetchAllPageItems 4000 条全拉的内存与延迟代价。
    const pr = await get<PageResponse<ConsoleFileRecordResponse>>('/api/console/queries/files', {
      tenantId: query.tenantId,
      pageNo: query.page,
      pageSize: query.pageSize,
      ...(query.fileStatus ? { fileStatus: query.fileStatus } : {}),
      ...(query.bizType ? { bizType: query.bizType } : {}),
      ...(query.fileName ? { fileName: query.fileName } : {}),
      ...(query.traceId ? { traceId: query.traceId } : {}),
      ...(query.fileId ? { fileId: query.fileId } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
    })
    return {
      records: (pr.items ?? []) as ConsoleFileRecordResponse[],
      total: pr.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    }
  },

  /**
   * 文件列表页领域汇总卡:今日到达 / 待处理 / 已处理 / 失败。
   * 当前本地 BE 的 /queries/files/summary 仍会 500;这里用稳定的 /queries/files total
   * 兜底组成汇总,避免页面统计卡显示全 0 且污染浏览器控制台。
   */
  summary: async (tenantId = readStoredTenantId()): Promise<ConsoleFileSummaryResponse> => {
    const today = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const todayText = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`
    const count = async (params: Record<string, string | number | undefined>) => {
      const pr = await get<PageResponse<ConsoleFileRecordResponse>>('/api/console/queries/files', {
        tenantId,
        pageNo: 1,
        pageSize: 1,
        ...params,
      })
      return Number(pr.total ?? 0)
    }
    const [arrivedToday, pending, processed, failed] = await Promise.all([
      count({ startDate: todayText, endDate: todayText }),
      count({ fileStatus: 'RECEIVED' }),
      count({ fileStatus: 'LOADED' }),
      count({ fileStatus: 'FAILED' }),
    ])
    return { arrivedToday, pending, processed, failed }
  },

  detail: (fileId: number, tenantId = readStoredTenantId()) =>
    get<ConsoleFileRecordDetailResponse>(`/api/console/queries/files/${fileId}`, { tenantId }),

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
