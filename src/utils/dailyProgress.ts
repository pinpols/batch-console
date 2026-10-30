import type { DeepReadonly } from 'vue'
import type { DailyProgress } from '@/api/dailyProgress'
export const DAILY_PROGRESS_SCOPES = [
  'SCHEDULED_OCCURRENCE',
  'TRIGGER_REQUEST',
  'WORKFLOW_RUN',
  'JOB_INSTANCE',
  'JOB_TASK',
] as const
export const DAILY_PROGRESS_BUCKETS = [
  'succeeded',
  'failed',
  'active',
  'pending',
  'skipped',
  'other',
] as const
export type DailyProgressBucket = (typeof DAILY_PROGRESS_BUCKETS)[number]
const succeeded = new Set(['SUCCESS', 'LAUNCHED'])
const failed = new Set([
  'FAILED',
  'PARTIAL_FAILED',
  'READINESS_TIMEOUT',
  'CLOSED_DAY_REJECTED',
  'REJECTED',
  'GIVE_UP',
])
const skipped = new Set([
  'SKIPPED',
  'CANCELLED',
  'TERMINATED',
  'MISFIRE_SKIPPED',
  'SKIPPED_CALENDAR',
  'DUPLICATE',
])
const active = new Set(['RUNNING', 'PROCESSING', 'RETRYING'])
const pending = new Set([
  'PLANNED',
  'REQUESTED',
  'WAITING_READINESS',
  'MISFIRE_PENDING',
  'CREATED',
  'READY',
  'PENDING',
  'WAITING',
  'WAITING_DEPENDENCY',
  'ACCEPTED',
  'FORWARD_FAILED',
  'PAUSED',
])
export function dailyProgressRows(snapshot: DeepReadonly<DailyProgress>) {
  return DAILY_PROGRESS_SCOPES.map((scope) => {
    const row = {
      scope,
      total: 0,
      ended: 0,
      succeeded: 0,
      failed: 0,
      active: 0,
      pending: 0,
      skipped: 0,
      other: 0,
      percentage: null as number | null,
    }
    snapshot.counts
      .filter((count) => count.scope === scope)
      .forEach((count) => {
        const status = count.status.replace(/^RUN_/, '')
        const bucket: DailyProgressBucket = succeeded.has(status)
          ? 'succeeded'
          : failed.has(status)
            ? 'failed'
            : skipped.has(status)
              ? 'skipped'
              : active.has(status)
                ? 'active'
                : pending.has(status)
                  ? 'pending'
                  : 'other'
        row[bucket] += count.count
        row.total += count.count
      })
    row.ended = row.succeeded + row.failed + row.skipped
    if (
      row.total > 0 &&
      (scope !== 'SCHEDULED_OCCURRENCE' || snapshot.coverage.uncoveredDefinitions === 0)
    )
      row.percentage = Math.round((100 * row.ended) / row.total)
    return row
  })
}
