import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { getPipelineProgressSnapshot } from '@/api/pipelineProgress'
import { createPipelineProgressSnapshotStream } from '@/api/stream'
import { useProgressSnapshot } from './useProgressSnapshot'
import { usePipelineProgress } from './usePipelineProgress'

/** 页面范围变动即关闭旧流；完整快照替换计数，历史分页不被新增尝试打乱。 */
export function useLivePipelineProgress(
  tenantId: MaybeRefOrGetter<string>,
  pipelineIds: MaybeRefOrGetter<readonly number[]>,
) {
  const ids = computed(() =>
    [...new Set(toValue(pipelineIds))]
      .filter((id) => Number.isSafeInteger(id) && id > 0)
      .sort((a, b) => a - b),
  )
  const key = computed(() => ids.value.join(','))
  const live = useProgressSnapshot(tenantId, key, {
    load: getPipelineProgressSnapshot,
    subscribe: createPipelineProgressSnapshotStream,
    matches: (data, scope) =>
      data.pipelines
        .map((p) => p.pipelineInstanceId)
        .sort((a, b) => a - b)
        .join(',') === scope,
    enabled: (scope) => Boolean(scope),
  })
  const metrics = usePipelineProgress(() => toValue(tenantId))
  watch(
    live.progress,
    (data) => {
      if (data) metrics.acceptSnapshot(data.pipelines, Date.parse(data.generatedAt))
      else metrics.reset()
    },
    { flush: 'sync' },
  )
  watch(
    live.error,
    (error) => {
      if (error) metrics.markUnavailable(ids.value)
    },
    { flush: 'sync' },
  )
  return {
    ...metrics,
    progress: live.progress,
    status: live.status,
    error: live.error,
    refresh: live.refresh,
    unavailable: computed(() => Boolean(live.error.value) || metrics.unavailable.value),
  }
}
