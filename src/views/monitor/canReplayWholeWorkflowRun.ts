const TERMINAL_WORKFLOW_RUN_STATUSES = new Set([
  'SUCCESS',
  'PARTIAL_FAILED',
  'FAILED',
  'CANCELLED',
  'TERMINATED',
])

export function canReplayWholeWorkflowRun(runStatus?: string | null): boolean {
  const runStatusText = String(runStatus ?? '')
  const normalizedRunStatus = runStatusText.toUpperCase()
  return TERMINAL_WORKFLOW_RUN_STATUSES.has(normalizedRunStatus)
}
