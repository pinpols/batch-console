import { post } from '@/api/client'
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
 * 用 Authorization 交换一次性 SSE ticket(后端 5 分钟过期、使用后立删)。
 * EventSource 不能自带 Authorization 头,因此须先换 ticket 再以 `?ticket=` 连流。
 */
export async function fetchStreamTicket(): Promise<string> {
  const res = await post<{ ticket: string }>('/api/console/auth/stream/ticket', {})
  return res.ticket
}

function resolvePath(domain: SseStreamType): string {
  const streamDomains: SseStreamType[] = ['job-instances', 'outbox-deliveries', 'outbox-retries']
  return streamDomains.includes(domain)
    ? `/api/console/stream/${domain}/events`
    : `/api/console/${domain}/events`
}

function buildStreamUrl(path: string, ticket: string): string {
  const base =
    typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''
  const qs = new URLSearchParams({ tenantId: readStoredTenantId(), ticket })
  return `${base}${path}?${qs.toString()}`
}

/**
 * 通用 SSE 流工厂 — 先 POST `/auth/stream/ticket` 换一次性 ticket,再连 `/{domain}/events?ticket=`。
 * 返回 Promise<EventSource>;调用方需 await。连接失败会抛错。
 */
export async function createSseStream(
  domain: SseStreamType,
  onMessage: (data: string) => void,
  onError?: (e: Event) => void,
): Promise<EventSource> {
  const ticket = await fetchStreamTicket()
  const url = buildStreamUrl(resolvePath(domain), ticket)
  const es = new EventSource(url)
  es.onmessage = (e) => onMessage(typeof e.data === 'string' ? e.data : String(e.data ?? ''))
  es.onerror = (e) => {
    onError?.(e)
    es.close()
  }
  return es
}

/** Spring SSE 使用命名 event;与 ConsoleRealtimeEventHub 生命周期及 job-instances 域事件对齐 */
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
 * 订阅作业实例实时 SSE(`/api/console/stream/job-instances/events`)。
 * 命名事件会序列化为 JSON 字符串交给回调。
 *
 * @param instanceId 若传入,则仅在解析到 `data.id` 与该 id 一致时回调(心跳/ready 等仍原样回调)。
 */
export async function createLogStream(
  instanceId: number,
  onMessage: (log: string) => void,
  onError?: (e: Event) => void,
): Promise<EventSource> {
  const ticket = await fetchStreamTicket()
  const url = buildStreamUrl('/api/console/stream/job-instances/events', ticket)
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
