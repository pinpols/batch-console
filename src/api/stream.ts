import { readStoredTenantId } from '@/api/interceptors'

type SseStreamType =
  | 'job-instances'
  | 'outbox-deliveries'
  | 'outbox-retries'
  | 'workers'
  | 'workflow-definitions'
  | 'workflow-runs'
  | 'alerts'
  | 'pipeline-definitions'

/**
 * 通用 SSE 流工厂 — 对应 `/api/console/stream/{domain}/events` 或 `/api/console/{domain}/events`。
 * 当前后端仅 `stream/job-instances/events` 走 `/stream/` 前缀，其余走各自根路径。
 */
export function createSseStream(
  domain: SseStreamType,
  onMessage: (data: string) => void,
  onError?: (e: Event) => void,
): EventSource {
  const token = localStorage.getItem('token') ?? ''
  const tenantId = readStoredTenantId()
  const base =
    typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''
  const qs = new URLSearchParams({ tenantId, token })
  // stream/* domains use /stream/ prefix; others use /{domain}/events directly
  const streamDomains: SseStreamType[] = ['job-instances', 'outbox-deliveries', 'outbox-retries']
  const path = streamDomains.includes(domain)
    ? `/api/console/stream/${domain}/events`
    : `/api/console/${domain}/events`
  const url = `${base}${path}?${qs.toString()}`
  const es = new EventSource(url)
  es.onmessage = (e) => onMessage(typeof e.data === 'string' ? e.data : String(e.data ?? ''))
  es.onerror = (e) => {
    onError?.(e)
    es.close()
  }
  return es
}

/** Spring SSE 使用命名 event；与 ConsoleRealtimeEventHub 生命周期及 job-instances 域事件对齐 */
const JOB_INSTANCE_SSE_EVENT_NAMES = [
  'ready',
  'heartbeat',
  'reset-required',
  'job-instance-updated',
] as const

function jobInstancePayloadId(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined
  const id = (data as { id?: unknown }).id
  return typeof id === 'number' ? id : undefined
}

/**
 * 订阅作业实例实时 SSE（`/api/console/stream/job-instances/events`）。
 * EventSource 无法带 Authorization 头，后端支持 `token` query；命名事件会序列化为 JSON 字符串交给回调。
 *
 * @param instanceId 若传入，则仅在解析到 `data.id` 与该 id 一致时回调（心跳/ready 等仍原样回调）。
 */
export function createLogStream(
  instanceId: number,
  onMessage: (log: string) => void,
  onError?: (e: Event) => void,
): EventSource {
  const token = localStorage.getItem('token') ?? ''
  const tenantId = readStoredTenantId()
  const base =
    typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''
  const qs = new URLSearchParams({
    tenantId,
    token,
  })
  const url = `${base}/api/console/stream/job-instances/events?${qs.toString()}`
  const es = new EventSource(url)

  const forward = (e: MessageEvent) => {
    const raw = typeof e.data === 'string' ? e.data : String(e.data ?? '')
    try {
      const parsed = JSON.parse(raw) as { data?: unknown }
      const pid = jobInstancePayloadId(parsed?.data)
      if (pid != null && pid !== instanceId) return
    } catch {
      /* 非 JSON 则不过滤 */
    }
    onMessage(raw)
  }

  for (const name of JOB_INSTANCE_SSE_EVENT_NAMES) {
    es.addEventListener(name, forward)
  }
  es.onmessage = forward
  es.onerror = (e) => {
    onError?.(e)
    es.close()
  }
  return es
}
