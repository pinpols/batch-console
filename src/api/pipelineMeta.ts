import { get } from '@/api/client'

/**
 * Pipeline 元信息 API:9 个固定 stages 字典 + 已注册 stepImpl 字典。
 * 给 PipelineDefinitionList 步骤编辑器把自由输入升级成下拉选择,避免用户手敲拼错。
 *
 * BE 路径:`/api/console/meta/pipeline-stages` / `/api/console/meta/step-impls`。
 */

export type PipelineType = 'IMPORT' | 'EXPORT' | 'PROCESS' | 'DISPATCH'

/** key 是 pipelineType,value 是该类型允许的 stage code 数组 */
export type PipelineStagesMap = Record<string, string[]>

export async function fetchPipelineStages(): Promise<PipelineStagesMap> {
  return get<PipelineStagesMap>('/api/console/meta/pipeline-stages')
}

/** module 不传 = 返全部已注册 impl(跨 pipelineType)。传 IMPORT/EXPORT/... 仅返该 module 注册的 */
export async function fetchStepImpls(module?: string): Promise<string[]> {
  const params = module ? { module } : undefined
  return get<string[]>('/api/console/meta/step-impls', params)
}
