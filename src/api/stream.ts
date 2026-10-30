import { post } from '@/api/client'
import { readStoredTenantId } from '@/api/interceptors'
import { createIdempotencyKey } from '@/utils/idempotency'
import type { WorkflowExecutionProgress } from '@/api/workflowRuns'
import type { AxiosRequestConfig } from 'axios'

type SseStreamType =
  | 'job-instances'
  | 'outbox-deliveries'
  | 'outbox-retries'
  | 'workers'
  | 'workflow-definitions'
  | 'workflow-runs'
  | 'alerts'
  | 'pipeline-progress'

/**
 * 通过当前 HttpOnly Cookie 会话换取一次性 SSE ticket，有效期由后端控制。
 * 先换票再以 `?ticket=` 连流；前端不读取或保存认证 token。
 */
export async function fetchStreamTicket(): Promise<string> {
  const res = await post<{ ticket: string }>('/api/console/auth/stream/ticket', {}, {
    _silent: true,
    // 新连接申请新票；同次HTTP重试仍由客户端保留本请求的键。
    headers: { 'Idempotency-Key': createIdempotencyKey() },
  } as AxiosRequestConfig)
  return res.ticket
}

function resolvePath(domain: SseStreamType): string {
  const streamDomains: SseStreamType[] = [
    'job-instances',
    'outbox-deliveries',
    'outbox-retries',
    'pipeline-progress',
  ]
  return streamDomains.includes(domain)
    ? `/api/console/stream/${domain}/events`
    : `/api/console/${domain}/events`
}

function buildStreamUrl(
  path: string,
  ticket: string,
  tenantId = readStoredTenantId(),
  extra: Record<string, string> = {},
): string {
  const base =
    typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : ''
  const qs = new URLSearchParams({ ...extra, tenantId, ticket })
  // 根地址“/”不能与“/api”拼成协议相对地址“//api”，所有流共用同一边界。
  return `${base.replace(/\/+$/, '')}${path}?${qs.toString()}`
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
  const path = resolvePath(domain)
  const url = buildStreamUrl(path, ticket)
  const es = new EventSource(url)
  const forward = (e: MessageEvent) =>
    onMessage(typeof e.data === 'string' ? e.data : String(e.data ?? ''))
  es.onmessage = forward
  for (const name of SSE_DOMAIN_EVENT_NAMES) {
    es.addEventListener(name, forward)
  }
  es.onerror = (e) => {
    onError?.(e)
    es.close()
  }
  return es
}

/** Spring SSE 使用命名 event；这里只转发业务 dirty 事件，避免 heartbeat 触发列表刷新。 */
const SSE_DOMAIN_EVENT_NAMES = [
  'alert-updated',
  'job-instance-updated',
  'outbox-cleanup',
  'outbox-delivery-updated',
  'outbox-republish',
  'outbox-retry-updated',
  'pipeline-definition-created',
  'pipeline-definition-toggled',
  'pipeline-definition-updated',
  'pipeline-progress-dirty',
  'worker-updated',
  'worker-warmup',
  'workflow-definition-created',
  'workflow-definition-full-updated',
  'workflow-definition-toggled',
  'workflow-definition-updated',
  'workflow-run-updated',
] as const

/** 详情页只消费会使实例数据变脏的事件；ready/heartbeat 仅用于保活，不应触发重复 GET。 */
const JOB_INSTANCE_SSE_EVENT_NAMES = ['reset-required', 'job-instance-updated'] as const

function jobInstancePayloadId(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined
  const id = (data as { id?: unknown }).id
  return typeof id === 'number' ? id : undefined
}

/**
 * 订阅作业实例实时 SSE(`/api/console/stream/job-instances/events`)。
 * 命名事件会序列化为 JSON 字符串交给回调。
 *
 * @param instanceId 若传入,则仅在解析到 `data.id` 与该 id 一致时回调；无 id 的 reset-required 仍会回调。
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
  es.onerror = (e) => {
    onError?.(e)
    es.close()
  }
  return es
}

export interface WorkflowExecutionStreamHandlers {
  snapshot: (snapshot: WorkflowExecutionProgress) => void
  ready: () => void
  error: () => void
  reset: () => void
}

/** 运行进度流携带完整快照；租户在换票之前固定，避免跨租户串流。 */
export async function createWorkflowExecutionStream(
  runId: number,
  tenantId: string,
  handlers: WorkflowExecutionStreamHandlers,
): Promise<EventSource> {
  const ticket = await fetchStreamTicket()
  const url = buildStreamUrl(
    `/api/console/workflow-runs/${runId}/execution-progress/events`,
    ticket,
    tenantId,
  )
  const es = new EventSource(url)
  es.addEventListener('ready', () => handlers.ready())
  es.addEventListener('reset-required', () => handlers.reset())
  const fail = () => {
    es.close()
    handlers.error()
  }
  es.addEventListener('workflow-execution-error', fail)
  es.addEventListener('workflow-execution-progress', (event: MessageEvent) => {
    try {
      const data = (JSON.parse(event.data) as { data?: WorkflowExecutionProgress }).data
      if (
        !data ||
        data.workflowRunId !== runId ||
        data.tenantId !== tenantId ||
        !Array.isArray(data.nodes) ||
        !Array.isArray(data.edges) ||
        !Number.isFinite(Date.parse(data.generatedAt))
      ) {
        fail()
        return
      }
      handlers.snapshot(data)
    } catch {
      fail()
    }
  })
  es.onerror = fail
  return es
}

/** 业务日聚合按选定日期隔离，在线直接接收五层完整计数。 */
export async function createDailyProgressStream(
  bizDate: string,
  tenantId: string,
  handlers: import('@/types/progress').ProgressStreamHandlers<
    import('@/api/dailyProgress').DailyProgress
  >,
): Promise<EventSource> {
  const ticket = await fetchStreamTicket()
  const url = buildStreamUrl('/api/console/dashboard/daily-progress/events', ticket, tenantId, {
    bizDate,
  })
  const source = new EventSource(url)
  const fail = () => {
    source.close()
    handlers.error()
  }
  source.addEventListener('ready', handlers.ready)
  source.addEventListener('reset-required', handlers.reset)
  source.addEventListener('daily-progress-error', fail)
  source.addEventListener('daily-progress', (event: MessageEvent) => {
    try {
      const data = (
        JSON.parse(event.data) as { data?: import('@/api/dailyProgress').DailyProgress }
      ).data
      if (
        !data ||
        data.tenantId !== tenantId ||
        data.bizDate !== bizDate ||
        !Array.isArray(data.counts) ||
        !data.coverage ||
        !Number.isFinite(Date.parse(data.generatedAt))
      ) {
        fail()
        return
      }
      handlers.snapshot(data)
    } catch {
      fail()
    }
  })
  source.onerror = fail
  return source
}

/** 作业完整阶段/计数快照，与Workflow和业务日复用范围校验及失联回退。 */
export async function createJobExecutionStream(
  jobId: number,
  tenantId: string,
  handlers: import('@/types/progress').ProgressStreamHandlers<
    import('@/api/jobProgress').JobExecutionProgress
  >,
): Promise<EventSource> {
  const ticket = await fetchStreamTicket()
  const source = new EventSource(
    buildStreamUrl(
      `/api/console/job-instances/${jobId}/execution-progress/events`,
      ticket,
      tenantId,
    ),
  )
  const fail = () => {
    source.close()
    handlers.error()
  }
  source.addEventListener('ready', handlers.ready)
  source.addEventListener('reset-required', handlers.reset)
  source.addEventListener('job-execution-progress-error', fail)
  source.addEventListener('job-execution-progress', (event: MessageEvent) => {
    try {
      const data = (
        JSON.parse(event.data) as { data?: import('@/api/jobProgress').JobExecutionProgress }
      ).data
      if (
        !data ||
        data.tenantId !== tenantId ||
        data.jobInstanceId !== jobId ||
        !Array.isArray(data.stages) ||
        !Array.isArray(data.counts) ||
        !Number.isFinite(Date.parse(data.generatedAt))
      ) {
        fail()
        return
      }
      handlers.snapshot(data)
    } catch {
      fail()
    }
  })
  source.onerror = fail
  return source
}

/** 完整Pipeline页范围快照；范围固定在换票前，不使用dirty事件触发GET。 */
export async function createPipelineProgressSnapshotStream(
  scope: string,
  tenantId: string,
  handlers: import('@/types/progress').ProgressStreamHandlers<
    import('@/api/pipelineProgress').PipelineProgressSnapshot
  >,
): Promise<EventSource> {
  const ticket = await fetchStreamTicket()
  const source = new EventSource(
    buildStreamUrl('/api/console/pipeline-progress/events', ticket, tenantId, {
      pipelineInstanceIds: scope,
    }),
  )
  const fail = () => {
    source.close()
    handlers.error()
  }
  source.addEventListener('ready', handlers.ready)
  source.addEventListener('reset-required', handlers.reset)
  source.addEventListener('pipeline-progress-snapshot-error', fail)
  source.addEventListener('pipeline-progress-snapshot', (event: MessageEvent) => {
    try {
      const data = (
        JSON.parse(event.data) as {
          data?: import('@/api/pipelineProgress').PipelineProgressSnapshot
        }
      ).data
      const ids = data?.pipelines
        ?.map((p) => p.pipelineInstanceId)
        .sort((a, b) => a - b)
        .join(',')
      if (
        !data ||
        data.tenantId !== tenantId ||
        ids !== scope ||
        !data.pipelines.every((p) => Array.isArray(p.steps) && Array.isArray(p.stageCodes)) ||
        !Number.isFinite(Date.parse(data.generatedAt))
      ) {
        fail()
        return
      }
      handlers.snapshot(data)
    } catch {
      fail()
    }
  })
  source.onerror = fail
  return source
}
