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
  ConsoleFilePresignUploadResponse,
  ConsoleFileUploadBindingRequest,
  ConsoleFileUploadTargetResponse,
  ConsoleFileSummaryResponse,
} from '@/types/console-api'

export interface FileQuery {
  tenantId?: string
  /** 精确匹配 */
  fileStatus?: string
  /** 模糊匹配 */
  bizType?: string
  /** 模糊匹配 */
  fileName?: string
  /** 精确匹配 */
  traceId?: string
  /** 精确匹配 */
  fileId?: string
  /** ISO 日期范围起点 */
  startDate?: string
  /** ISO 日期范围终点 */
  endDate?: string
  /** 使用服务端时区筛选今日到达 */
  arrivalToday?: boolean
  page: number
  pageSize: number
  cursor?: string | null
}

export const fileApi = {
  /** 作业详情抽屉中的关联文件分页。 */
  listRelatedToJob: (tenantId: string, jobCode: string, pageNo: number, pageSize: number) =>
    get<PageResponse<ConsoleFileRecordResponse>>('/api/console/queries/files', {
      tenantId,
      jobCode,
      pageNo,
      pageSize,
    }),

  list: async (query: FileQuery) => {
    // 全字段过滤后端原生支持（FileStatus/BizType/FileName/TraceId/FileId/Start/EndDate
    // 均已在 console-api.openapi.yaml 的 /queries/files parameters 中声明），
    // 直接走服务端分页 + 过滤，避免 fetchAllPageItems 4000 条全拉的内存与延迟代价。
    const pr = await get<PageResponse<ConsoleFileRecordResponse>>('/api/console/queries/files', {
      tenantId: query.tenantId,
      pageNo: query.page,
      pageSize: query.pageSize,
      ...(query.cursor !== undefined ? { cursor: query.cursor ?? '' } : {}),
      ...(query.fileStatus ? { fileStatus: query.fileStatus } : {}),
      ...(query.bizType ? { bizType: query.bizType } : {}),
      ...(query.fileName ? { fileName: query.fileName } : {}),
      ...(query.traceId ? { traceId: query.traceId } : {}),
      ...(query.fileId ? { fileId: query.fileId } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
      ...(query.arrivalToday ? { arrivalToday: true } : {}),
    })
    return {
      records: (pr.items ?? []) as ConsoleFileRecordResponse[],
      total: pr.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      nextCursor: pr.nextCursor ?? null,
      hasMore: pr.hasMore ?? (pr.total != null && query.page * query.pageSize < pr.total),
    }
  },

  /**
   * 文件列表页领域汇总卡:今日到达 / 待处理 / 已处理 / 失败。
   * 通过稳定的 /queries/files 分页总数按口径组成汇总，避免依赖额外的聚合接口。
   */
  summary: async (tenantId = readStoredTenantId()): Promise<ConsoleFileSummaryResponse> => {
    const count = async (params: Record<string, string | number | boolean | undefined>) => {
      const pr = await get<PageResponse<ConsoleFileRecordResponse>>('/api/console/queries/files', {
        tenantId,
        pageNo: 1,
        pageSize: 1,
        ...params,
      })
      return Number(pr.total ?? 0)
    }
    const [arrivedToday, pending, processed, failed] = await Promise.all([
      count({ arrivalToday: true }),
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
      .sort((a, b) => {
        const rightCreatedAt = String(b.createdAt ?? '')
        const leftCreatedAt = String(a.createdAt ?? '')
        return rightCreatedAt.localeCompare(leftCreatedAt)
      })
  },

  listArrivalGroups: (tenantId: string) =>
    fetchAllPageItems<ConsoleFileArrivalGroupResponse>('/api/console/queries/file-arrival-groups', {
      tenantId,
    }),

  listManualUploadTargets: (tenantId: string) =>
    get<ConsoleFileUploadTargetResponse[]>('/api/console/files/manual-upload-targets', {
      tenantId,
    }),

  confirmArrival: (fileGroupCode: string, tenantId: string) =>
    post('/api/console/files/arrival-groups/action', {
      tenantId,
      fileGroupCode,
      action: 'CONFIRM',
    }),

  /** POST /api/console/files/presign-upload */
  presignUpload: (
    tenantId: string,
    channelCode: string,
    fileName: string,
    idempotencyKey: string,
    binding?: ConsoleFileUploadBindingRequest,
  ) =>
    post<ConsoleFilePresignUploadResponse>('/api/console/files/presign-upload', binding, {
      params: { tenantId, channelCode, fileName },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  /** PUT /api/console/files/{fileId}/content — FormData 字段名来自后端 upload session 契约。 */
  uploadContent: async (fileId: number, tenantId: string, file: File, idempotencyKey: string) => {
    const body = new FormData()
    body.append('file', file)
    const { data } = await apiClient.put<ConsoleFileOperationResponse>(
      `/api/console/files/${fileId}/content`,
      body,
      {
        params: { tenantId },
        headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': idempotencyKey,
        },
        timeout: 120_000,
      },
    )
    return data
  },

  /** POST /api/console/files/{fileId}/confirm-arrival */
  confirmFileArrival: (fileId: number, tenantId: string, idempotencyKey: string) =>
    post<ConsoleFileOperationResponse>(`/api/console/files/${fileId}/confirm-arrival`, undefined, {
      params: { tenantId },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  /** GET /api/console/files/{fileId}/errors/export — 下载 CSV */
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
