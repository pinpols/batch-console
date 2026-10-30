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

export function progressStatus(
  status: string | null | undefined,
): 'success' | 'warning' | 'exception' | undefined {
  const statusText = String(status ?? '')
  const s = statusText.toUpperCase()
  if (s === 'ONLINE') return 'success'
  if (s === 'DRAINING') return 'warning'
  if (s === 'OFFLINE') return 'exception'
  return undefined
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

export function clampLoadPercentage(load: unknown): number {
  const numericLoad = Number(load) || 0
  const nonNegativeLoad = Math.max(0, numericLoad)
  return Math.min(100, nonNegativeLoad)
}
