import { get } from '@/api/client'
import type { operations } from '@/types/api.generated'
import type { PageResponse } from '@/types'
import type {
  ConsoleFileDispatchRecordResponse,
  ConsoleFileErrorRecordResponse,
  ConsoleFilePipelineResponse,
  ConsoleFilePipelineStepResponse,
} from '@/types/console-api'

/**
 * File pipeline 行级进度查询。
 *
 * BE 端点:
 *   `GET /api/console/queries/pipeline-progress?pipelineInstanceId=X`
 *
 * 设计书:`file-batch-system/docs/design/pipeline-stage-progress-display.md`(file-batch-system 仓)
 *
 * 降级策略:BE 端点异常时 `queryPipelineProgress` 抛出由调用方捕获,
 * 视图层明确展示进度不可用，不将失败伪装为空快照。
 */

/** 直接派生正式响应，字段可选性随 OpenAPI 演进。 */
export type PipelineProgressResponse = NonNullable<
  operations['queryPipelineProgress']['responses'][200]['content']['application/json']['data']
>
export type PipelineStepProgress = NonNullable<PipelineProgressResponse['steps']>[number]

export async function queryPipelineProgress(
  pipelineInstanceId: number | string,
): Promise<PipelineProgressResponse> {
  return get<PipelineProgressResponse>('/api/console/queries/pipeline-progress', {
    pipelineInstanceId,
  })
}

interface FilePipelinePageParams {
  tenantId: string
  pageNo: number
  pageSize: number
  keyword?: string
  pipelineInstanceId?: number
  stageCode?: string
}

export function queryFilePipelinePage(params: FilePipelinePageParams) {
  return get<PageResponse<ConsoleFilePipelineResponse>>(
    '/api/console/queries/file-pipelines',
    params,
  )
}

export function queryFilePipelineStepPage(params: FilePipelinePageParams) {
  return get<PageResponse<ConsoleFilePipelineStepResponse>>(
    '/api/console/queries/file-pipeline-steps',
    params,
  )
}

export function queryFileDispatchPage(params: FilePipelinePageParams) {
  return get<PageResponse<ConsoleFileDispatchRecordResponse>>(
    '/api/console/queries/file-dispatches',
    params,
  )
}

export function queryFileErrorPage(params: FilePipelinePageParams) {
  return get<PageResponse<ConsoleFileErrorRecordResponse>>(
    '/api/console/queries/file-errors',
    params,
  )
}
