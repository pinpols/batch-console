import { computed, onScopeDispose, ref, watch, type DeepReadonly } from 'vue'
import {
  queryPipelineProgress,
  type PipelineProgressResponse,
  type PipelineStepProgress,
} from '@/api/filePipelineQuery'

const HISTORY_WINDOW_MS = 60_000
const MAX_HISTORY_SAMPLES = 12

/** 仅保存当前查询范围的进度；失败保留旧采样，成功空快照明确清除旧数据。 */
export function usePipelineProgress(tenantId: () => string) {
  const byStepId = ref(new Map<number, PipelineStepProgress>())
  const failedPipelineIds = ref(new Set<number>())
  const lastSucceededAt = ref<number | null>(null)
  const history = new Map<number, { ts: number; processed: number }[]>()
  let generation = 0

  function reset() {
    generation++
    byStepId.value = new Map()
    failedPipelineIds.value = new Set()
    lastSucceededAt.value = null
    history.clear()
  }

  function recordHistory() {
    const now = Date.now()
    for (const id of history.keys()) {
      if (!byStepId.value.has(id)) history.delete(id)
    }
    for (const [id, sample] of byStepId.value) {
      if (sample.rowsProcessed == null) continue
      const samples = history.get(id) ?? []
      samples.push({ ts: now, processed: sample.rowsProcessed })
      const recentSamples = samples.filter((s) => s.ts >= now - HISTORY_WINDOW_MS * 2)
      const boundedSamples = recentSamples.slice(-MAX_HISTORY_SAMPLES)
      history.set(id, boundedSamples)
    }
  }

  function estimateMinutes(sample: PipelineStepProgress): number | null {
    if (sample.stepId == null || sample.totalRowsHint == null || sample.rowsProcessed == null)
      return null
    const samples = history.get(sample.stepId) ?? []
    if (samples.length < 2) return null
    const first = samples[0]
    const last = samples[samples.length - 1]
    const windowMs = last.ts - first.ts
    const delta = last.processed - first.processed
    const remaining = sample.totalRowsHint - sample.rowsProcessed
    const progressIsInsufficientForEstimate =
      windowMs < HISTORY_WINDOW_MS || delta <= 0 || remaining <= 0
    if (progressIsInsufficientForEstimate) return null
    const estimatedMinutes = Math.round((remaining * windowMs) / delta / 60_000)
    return Math.max(1, estimatedMinutes)
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
    if (!failed.size) {
      lastSucceededAt.value = Date.now()
      recordHistory()
    } else {
      history.clear()
    }
    return failed.size === 0
  }

  function acceptSnapshot(
    pipelines: readonly DeepReadonly<PipelineProgressResponse>[],
    timestamp: number,
  ) {
    generation++
    const next = new Map<number, PipelineStepProgress>()
    for (const pipeline of pipelines)
      for (const step of pipeline.steps ?? [])
        if (step.stepId != null && step.pipelineInstanceId === pipeline.pipelineInstanceId)
          next.set(step.stepId, step)
    byStepId.value = next
    failedPipelineIds.value = new Set()
    lastSucceededAt.value = timestamp
    recordHistory()
  }
  function markUnavailable(ids: readonly number[]) {
    failedPipelineIds.value = new Set(ids)
    history.clear()
  }

  return {
    acceptSnapshot,
    markUnavailable,
    byStepId,
    failedPipelineIds,
    unavailable: computed(() => failedPipelineIds.value.size > 0),
    lastSucceededAt,
    refresh,
    reset,
    estimateMinutes,
  }
}
