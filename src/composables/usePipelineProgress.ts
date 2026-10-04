import { computed, onScopeDispose, ref, watch } from 'vue'
import { queryPipelineProgress, type PipelineStepProgress } from '@/api/filePipelineQuery'

/** 仅保存当前查询范围的进度；失败保留旧采样，成功空快照明确清除旧数据。 */
export function usePipelineProgress(tenantId: () => string) {
  const byStepId = ref(new Map<number, PipelineStepProgress>())
  const failedPipelineIds = ref(new Set<number>())
  const lastSucceededAt = ref<number | null>(null)
  let generation = 0

  function reset() {
    generation++
    byStepId.value = new Map()
    failedPipelineIds.value = new Set()
    lastSucceededAt.value = null
  }

  watch(tenantId, reset, { flush: 'sync' })
  onScopeDispose(reset)

  async function refresh(pipelineIds: number[]): Promise<boolean> {
    const request = ++generation
    const ids = [...new Set(pipelineIds)]
    if (!ids.length) {
      reset()
      return false
    }
    const results = await Promise.allSettled(ids.map(queryPipelineProgress))
    if (request !== generation) return false

    const next = new Map(
      [...byStepId.value].filter(
        ([, step]) => step.pipelineInstanceId != null && ids.includes(step.pipelineInstanceId),
      ),
    )
    const failed = new Set<number>()
    results.forEach((result, index) => {
      const id = ids[index]
      if (result.status === 'rejected') {
        failed.add(id)
        return
      }
      for (const [stepId, step] of next) {
        if (step.pipelineInstanceId === id) next.delete(stepId)
      }
      for (const step of result.value.steps ?? []) {
        if (step.stepId != null && step.pipelineInstanceId === id) next.set(step.stepId, step)
      }
    })
    byStepId.value = next
    failedPipelineIds.value = failed
    // 部分失败也不更新整批成功时间，避免把旧采样呈现为刚刷新。
    if (!failed.size) lastSucceededAt.value = Date.now()
    return failed.size === 0
  }

  return {
    byStepId,
    failedPipelineIds,
    unavailable: computed(() => failedPipelineIds.value.size > 0),
    lastSucceededAt,
    refresh,
    reset,
  }
}
