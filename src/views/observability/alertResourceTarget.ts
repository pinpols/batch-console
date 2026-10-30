export type AlertResourceTarget = {
  type: 'jobInstance' | 'workflowRun'
  id: string
  path: string
}

function parsePositiveId(value: unknown): string | null {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const maxSafeId = String(Number.MAX_SAFE_INTEGER)
    if (value.length < maxSafeId.length) return value
    if (value.length === maxSafeId.length && value <= maxSafeId) return value
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return null
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function getAlertResourceTarget(detailJson: string): AlertResourceTarget | null {
  let details: Record<string, unknown> | null
  try {
    const parsedDetails = JSON.parse(detailJson) as unknown
    details = readObject(parsedDetails)
  } catch {
    return null
  }
  if (!details) return null

  const workflowRunId = parsePositiveId(details.workflowRunId)
  if (workflowRunId) {
    return {
      type: 'workflowRun',
      id: workflowRunId,
      path: `/monitor/workflow-runs/${workflowRunId}`,
    }
  }

  const jobInstanceId = parsePositiveId(details.jobInstanceId)
  if (jobInstanceId) {
    return {
      type: 'jobInstance',
      id: jobInstanceId,
      path: `/monitor/job-instances/${jobInstanceId}`,
    }
  }

  return null
}
