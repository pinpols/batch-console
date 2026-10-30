export function canReplayFailedWorkflowJobNode(
  runStatus?: string | null,
  nodeType?: string | null,
  nodeStatus?: string | null,
  jobInstanceId?: number | null,
): boolean {
  const runStatusText = String(runStatus ?? '')
  const normalizedRunStatus = runStatusText.toUpperCase()
  if (normalizedRunStatus !== 'FAILED') return false

  const nodeTypeText = String(nodeType ?? '')
  const normalizedNodeType = nodeTypeText.toUpperCase()
  if (normalizedNodeType !== 'JOB') return false

  const nodeStatusText = String(nodeStatus ?? '')
  const normalizedNodeStatus = nodeStatusText.toUpperCase()
  if (normalizedNodeStatus !== 'FAILED') return false

  if (!Number.isSafeInteger(jobInstanceId)) return false
  return Number(jobInstanceId) > 0
}
