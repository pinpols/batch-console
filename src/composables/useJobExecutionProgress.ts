import type { MaybeRefOrGetter } from 'vue'
import { getJobExecutionProgress } from '@/api/jobProgress'
import { createJobExecutionStream } from '@/api/stream'
import { useProgressSnapshot } from './useProgressSnapshot'
export function useJobExecutionProgress(
  tenant: MaybeRefOrGetter<string>,
  id: MaybeRefOrGetter<number>,
) {
  return useProgressSnapshot(tenant, id, {
    load: getJobExecutionProgress,
    subscribe: createJobExecutionStream,
    matches: (snapshot, key) => snapshot.jobInstanceId === key,
    enabled: (key) => Number.isSafeInteger(key) && key > 0,
  })
}
