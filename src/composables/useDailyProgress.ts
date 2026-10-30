import type { MaybeRefOrGetter } from 'vue'
import { getDailyProgress } from '@/api/dailyProgress'
import { createDailyProgressStream } from '@/api/stream'
import { useProgressSnapshot } from './useProgressSnapshot'
export function useDailyProgress(
  tenantId: MaybeRefOrGetter<string>,
  bizDate: MaybeRefOrGetter<string>,
) {
  return useProgressSnapshot(tenantId, bizDate, {
    load: getDailyProgress,
    subscribe: createDailyProgressStream,
    matches: (snapshot, date) => snapshot.bizDate === date,
    enabled: (date) => /^\d{4}-\d{2}-\d{2}$/.test(date),
  })
}
