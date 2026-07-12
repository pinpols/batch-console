import { get } from '@/api/client'

/**
 * File pipeline 行级进度查询。
 *
 * BE 端点:
 *   `GET /api/console/queries/pipeline-progress?pipelineInstanceId=X`
 *
 * 设计书:`file-batch-system/docs/design/pipeline-stage-progress-display.md`(file-batch-system 仓)
 *
 * 降级策略:BE 端点异常时 `queryPipelineProgress` 抛出由调用方捕获,
 * 视图层显示「—」即可,不阻塞页面。
 */

/** 单个 step / stage 的行级进度采样(BE 一次性返当前 pipeline 全部 step) */
export interface PipelineStepProgress {
  /** pipeline_step_run.id */
  stepId: number
  pipelineInstanceId: number
  stepCode: string
  stageCode: string
  /** 已处理行数;BE 未上报则为 null,UI 显示「—」 */
  rowsProcessed: number | null
  /** 总行数预估;未知则 null,UI 不显示 ETA */
  totalRowsHint: number | null
  /** 最近一次心跳时间(epoch ms);UI 据此判断「无响应」灰态(> 90s) */
  lastHeartbeatAt: number | null
}

export interface PipelineProgressResponse {
  pipelineInstanceId: number
  /** 当前 pipeline 关联的文件 id;BE #811 起顶层透出,未知则 null */
  fileId?: number | null
  /** 当前 pipeline 关联的文件名;BE #811 起顶层透出,未知则 null,UI 回退显 fileId */
  fileName?: string | null
  steps: PipelineStepProgress[]
}

export async function queryPipelineProgress(
  pipelineInstanceId: number | string,
): Promise<PipelineProgressResponse> {
  return get<PipelineProgressResponse>('/api/console/queries/pipeline-progress', {
    pipelineInstanceId,
  })
}

/**
 * 包装版:BE 端点未合入时(404 / 500)直接返空 steps,
 * 让上层 UI 走「—」降级,不抛错刷红整个页面。
 */
export async function queryPipelineProgressSafe(
  pipelineInstanceId: number | string,
): Promise<PipelineProgressResponse> {
  try {
    return await queryPipelineProgress(pipelineInstanceId)
  } catch {
    return {
      pipelineInstanceId: Number(pipelineInstanceId),
      fileId: null,
      fileName: null,
      steps: [],
    }
  }
}
