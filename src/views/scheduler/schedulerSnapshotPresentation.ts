type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'
const TAG_TYPES: TagType[] = ['primary', 'success', 'warning', 'danger', 'info']

export function tagTypeForKey(key: string | null | undefined): TagType {
  const keyValue = key ?? ''
  const keyText = String(keyValue)
  const s = keyText.trim()
  if (!s) return 'info'
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return TAG_TYPES[hash % TAG_TYPES.length]
}

export function summarizeWorkerStates(workers: { status?: string | null }[]) {
  const counts = { online: 0, offline: 0, draining: 0, unknown: 0 }
  for (const worker of workers) {
    const status = worker.status?.toUpperCase()
    if (status === 'ONLINE') counts.online++
    else if (status === 'OFFLINE') counts.offline++
    else if (status === 'DRAINING') counts.draining++
    else counts.unknown++
  }
  return counts
}

/** 使用后端明确的分区上限；无上限时不推算百分比，超限时仍保留真实计数。 */
export function queuePartitionCapacity(active: unknown, limit: unknown) {
  if (typeof active !== 'number' || !Number.isFinite(active) || active < 0) return null
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return null
  return { active, limit, percent: Math.min(100, Math.round((active / limit) * 100)) }
}

export function errorCorrelation(reason: unknown): string {
  const response = (reason as { response?: { data?: unknown; headers?: unknown } })?.response
  const data = response?.data as { meta?: { traceId?: unknown; requestId?: unknown } } | undefined
  const fromMeta = data?.meta?.traceId ?? data?.meta?.requestId
  if (fromMeta) return String(fromMeta)
  const headers = response?.headers as
    { get?: (name: string) => unknown; [key: string]: unknown } | undefined
  const fromHeader =
    headers?.get?.('x-trace-id') ??
    headers?.get?.('x-request-id') ??
    headers?.['x-trace-id'] ??
    headers?.['x-request-id']
  return fromHeader ? String(fromHeader) : ''
}

export function panelDotClass(panel: 'policies' | 'queues' | 'workers' | 'history'): string {
  return {
    policies: 'dot--primary',
    queues: 'dot--success',
    workers: 'dot--warning',
    history: 'dot--info',
  }[panel]
}
