/**
 * Pipeline step「已处理行数」从 step 的 outputSummary 兜底解析。
 *
 * 背景:steps tab 的实时进度走 orchestrator 内存 cache(key=workerCode,仅运行中步骤有值);
 * 而**完成步骤**的计数其实已落在 `pipeline_step_run.output_summary`(各 worker stage executor 的
 * buildOutputSummary 写入累计 attribute 快照),响应里就有,无需 BE 端点。本工具把它解析出来。
 *
 * stage→key 映射对应 file-batch-system 各 stage 枚举的产出计数:
 *   import  RECEIVE/PREPROCESS/PARSE/VALIDATE/LOAD/FEEDBACK → parsedCount/validatedCount/loadedCount
 *   export  PREPARE/GENERATE/STORE/REGISTER/COMPLETE        → recordCount
 *   process PREPARE/COMPUTE/VALIDATE/COMMIT/FEEDBACK         → processedCount/stagedCount/publishedCount
 */

/** stageCode → outputSummary 里的主计数字段。 */
export const STAGE_COUNT_KEY: Record<string, string> = {
  PARSE: 'parsedCount',
  VALIDATE: 'validatedCount',
  LOAD: 'loadedCount',
  FEEDBACK: 'loadedCount',
  GENERATE: 'recordCount',
  STORE: 'recordCount',
  REGISTER: 'recordCount',
  COMPUTE: 'processedCount',
  COMMIT: 'publishedCount',
}

/**
 * 跨 worker 类型 stageCode 有重名(如 VALIDATE 在 import / process 都有,但 process 的 summary 里
 * 没有 validatedCount),按 stage 主键取不到时退化到这个优先级列表挑「最有意义的计数」,
 * 保证显示的是该步真实产出的数,而不是错配的字段。
 */
export const COUNT_KEY_FALLBACK = [
  'loadedCount',
  'recordCount',
  'processedCount',
  'publishedCount',
  'validatedCount',
  'parsedCount',
  'stagedCount',
] as const

/**
 * 从 step 的 stageCode + outputSummary(JSON 字符串或已解析对象)解析「已处理行数」。
 *
 * @returns 解析到的计数;无 summary / 非法 JSON / 无任何计数字段时返回 null(UI 显示「—」)
 */
export function processedCountFromSummary(
  stageCode: string | null | undefined,
  outputSummary: string | Record<string, unknown> | null | undefined,
): number | null {
  if (!outputSummary) return null
  let obj: Record<string, unknown>
  try {
    const parsed = typeof outputSummary === 'string' ? JSON.parse(outputSummary) : outputSummary
    if (!parsed || typeof parsed !== 'object') return null
    obj = parsed as Record<string, unknown>
  } catch {
    return null
  }
  const pick = (key: string): number | null =>
    typeof obj[key] === 'number' && Number.isFinite(obj[key]) ? (obj[key] as number) : null

  const byStage = STAGE_COUNT_KEY[stageCode ?? '']
  if (byStage) {
    const v = pick(byStage)
    if (v != null) return v
  }
  for (const key of COUNT_KEY_FALLBACK) {
    const v = pick(key)
    if (v != null) return v
  }
  return null
}
