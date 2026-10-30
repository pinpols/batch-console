import type { MaybeRefOrGetter } from 'vue'
import { getWorkflowExecutionProgress } from '@/api/workflowRuns'
import { createWorkflowExecutionStream } from '@/api/stream'
import { useProgressSnapshot } from './useProgressSnapshot'

/** Workflow运行视图固定实例与租户身份，共享推送快照生命周期。 */
export function useWorkflowExecutionProgress(
  tenantId: MaybeRefOrGetter<string>,
  runId: MaybeRefOrGetter<number>,
) {
  return useProgressSnapshot(tenantId, runId, {
    load: getWorkflowExecutionProgress,
    subscribe: createWorkflowExecutionStream,
    matches: (snapshot, id) => snapshot.workflowRunId === id,
    enabled: (id) => Number.isSafeInteger(id) && id > 0,
  })
}
