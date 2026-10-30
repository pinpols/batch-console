import type { ConsoleWorkflowNodeRunResponse } from '@/types/console-api'

type Translate = (key: string) => string

const REASON_KEYS: Record<string, string> = {
  CONDITION_NOT_MATCHED: 'monitor.nodeSkipReasonConditionNotMatched',
  UPSTREAM_FAILED: 'monitor.nodeSkipReasonUpstreamFailed',
  UPSTREAM_SKIPPED: 'monitor.nodeSkipReasonUpstreamSkipped',
  NO_MATCHING_INCOMING_EDGE: 'monitor.nodeSkipReasonNoMatchingEdge',
  OPERATOR_SKIPPED: 'monitor.nodeSkipReasonOperator',
}

export function workflowNodeSkipReasonText(
  row: ConsoleWorkflowNodeRunResponse,
  translate: Translate,
): string {
  if (row.nodeStatus !== 'SKIPPED') return ''
  if (row.skipReason?.trim()) return row.skipReason
  const key = REASON_KEYS[row.skipReasonCode ?? '']
  return translate(key ?? 'monitor.nodeSkipReasonUnknown')
}
