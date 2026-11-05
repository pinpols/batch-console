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

/** 旧版后端会把 detailJson 当作展示文本做 HTML 转义（引号变成 &quot;），解析失败时还原实体再试一次 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function parseDetails(detailJson: string): Record<string, unknown> | null {
  for (const candidate of [detailJson, decodeHtmlEntities(detailJson)]) {
    try {
      return readObject(JSON.parse(candidate) as unknown)
    } catch {
      // 继续尝试还原实体后的文本
    }
  }
  return null
}

export function getAlertResourceTarget(detailJson: string): AlertResourceTarget | null {
  const details = parseDetails(detailJson)
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
