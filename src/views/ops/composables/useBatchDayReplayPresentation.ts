import { computed } from 'vue'
import type { StatusSegmentItem } from '@/components/table/StatusSegment.vue'
import type { BatchDayReplaySession, ReplayOperation } from '@/api/batchDayReplay'

/** 批次日重放的状态展示与本地化标签。 */
export function useBatchDayReplayPresentation(t: (key: string) => string) {
  const replayScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      ALL: t('batchDayReplay.scopeAll'),
      ALL_FAILED: t('batchDayReplay.scopeAllFailed'),
      SUBSET_JOB_CODES: t('batchDayReplay.scopeSubsetJobCodes'),
      OUTPUTS_ONLY: t('batchDayReplay.scopeOutputsOnly'),
    }
    return labels[scope] ?? scope
  }
  const replayActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      RERUN_INSTANCE: t('batchDayReplay.previewActionRerun'),
      LAUNCH_SCHEDULE_PLAN: t('batchDayReplay.previewActionLaunch'),
      PROMOTE_RESULT_VERSION: t('batchDayReplay.previewActionPromote'),
    }
    return labels[action] ?? action
  }
  const entriesStatusItems = computed<StatusSegmentItem[]>(() => [
    { value: '', label: t('batchDayReplay.allEntries'), tone: 'neutral' },
    {
      value: 'PENDING',
      label: t('batchDayReplay.entryStatusPending'),
      tone: 'warning',
    },
    {
      value: 'SUCCEEDED',
      label: t('batchDayReplay.entryStatusSucceeded'),
      tone: 'success',
    },
    {
      value: 'FAILED',
      label: t('batchDayReplay.entryStatusFailed'),
      tone: 'danger',
    },
  ])
  function scopeTagType(scope: string): 'primary' | 'warning' | 'success' | 'info' {
    if (scope === 'ALL') return 'primary'
    if (scope === 'ALL_FAILED') return 'warning'
    if (scope === 'OUTPUTS_ONLY') return 'success'
    return 'info'
  }
  function statusTagType(s: string): 'primary' | 'success' | 'danger' | 'warning' | 'info' {
    if (s === 'RUNNING') return 'primary'
    if (s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED' || s === 'PARTIAL_FAILED') return 'danger'
    if (s === 'PENDING_APPROVAL') return 'warning'
    return 'info'
  }
  function operationProgressPct(operation: ReplayOperation): number {
    if (!operation.totalCount) return 0
    return Math.round(
      ((operation.succeededCount + operation.failedCount) / operation.totalCount) * 100,
    )
  }
  function entryStatusTagType(s: string): 'success' | 'danger' | 'info' {
    if (s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED') return 'danger'
    return 'info'
  }
  function progressPct(s: BatchDayReplaySession): number {
    const total = s.totalCount ?? 0
    if (total === 0) return 0
    const done = (s.succeededCount ?? 0) + (s.failedCount ?? 0)
    return Math.round((done / total) * 100)
  }
  function progressStatus(s: BatchDayReplaySession): 'success' | 'exception' | undefined {
    if (s.status === 'SUCCEEDED') return 'success'
    if (s.status === 'FAILED') return 'exception'
    return undefined
  }

  return {
    replayScopeLabel,
    replayActionLabel,
    entriesStatusItems,
    scopeTagType,
    statusTagType,
    operationProgressPct,
    entryStatusTagType,
    progressPct,
    progressStatus,
  }
}
