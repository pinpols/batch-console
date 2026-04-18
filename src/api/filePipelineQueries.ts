import { get } from '@/api/client'
import type { PageResponse } from '@/types'
import type {
  ConsoleFileDispatchRecordResponse,
  ConsoleFileErrorRecordResponse,
  ConsoleFilePipelineResponse,
  ConsoleFilePipelineStepResponse,
} from '@/types/console-api'

function paged<T>(url: string, tenantId: string, pageNo: number, pageSize: number) {
  return get<PageResponse<T>>(url, { tenantId, pageNo, pageSize })
}

/** 文件流水线、步骤、投递、错误 — 均为 PageResponse */
export const filePipelineQueries = {
  pipelines: (tenantId: string, pageNo: number, pageSize: number) =>
    paged<ConsoleFilePipelineResponse>(
      '/api/console/queries/file-pipelines',
      tenantId,
      pageNo,
      pageSize,
    ),

  steps: (tenantId: string, pageNo: number, pageSize: number) =>
    paged<ConsoleFilePipelineStepResponse>(
      '/api/console/queries/file-pipeline-steps',
      tenantId,
      pageNo,
      pageSize,
    ),

  dispatches: (tenantId: string, pageNo: number, pageSize: number) =>
    paged<ConsoleFileDispatchRecordResponse>(
      '/api/console/queries/file-dispatches',
      tenantId,
      pageNo,
      pageSize,
    ),

  errors: (tenantId: string, pageNo: number, pageSize: number) =>
    paged<ConsoleFileErrorRecordResponse>(
      '/api/console/queries/file-errors',
      tenantId,
      pageNo,
      pageSize,
    ),
}
