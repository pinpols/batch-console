/**
 * 前端行为埋点 SDK
 *
 * - 内存队列批量上报，减少请求频次
 * - 页面关闭时 sendBeacon 兜底
 * - 自动采集 userId / tenantId / 页面信息
 * - 上报失败静默丢弃，不影响业务
 */

export type TelemetryEventType =
  | 'page_view'
  | 'click'
  | 'api_call'
  | 'api_error'
  | 'js_error'
  | 'custom'

export interface TelemetryEvent {
  /** 事件类型 */
  type: TelemetryEventType
  /** 事件名称 */
  name: string
  /** 时间戳 ISO */
  ts: string
  /** 页面路径 */
  page: string
  /** 附加数据 */
  props?: Record<string, unknown>
}

interface TelemetryPayload {
  /** 应用标识 */
  app: string
  /** 用户 ID */
  userId: string | null
  /** 租户 ID */
  tenantId: string | null
  /** 浏览器 UA */
  ua: string
  /** 屏幕分辨率 */
  screen: string
  /** 会话 ID（tab 级） */
  sessionId: string
  /** 事件列表 */
  events: TelemetryEvent[]
}

// ---- 配置 ----

const APP_NAME = 'batch-console'
const FLUSH_INTERVAL_MS = 15_000 // 15s 批量上报
const MAX_QUEUE_SIZE = 100 // 队列上限，超过立即 flush
const MAX_BATCH_SIZE = 50 // 单次上报最大条数

let endpoint = '' // 由 initTelemetry 设置
let enabled = false
let queue: TelemetryEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null

// tab 级 session ID
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---- 环境信息 ----

function getUserId(): string | null {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub || payload.userId || null
  } catch {
    return null
  }
}

function getTenantId(): string | null {
  return localStorage.getItem('batch-console-tenant-id') || null
}

// ---- 认证 ----

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ---- 核心 ----

function buildPayload(events: TelemetryEvent[]): TelemetryPayload {
  return {
    app: APP_NAME,
    userId: getUserId(),
    tenantId: getTenantId(),
    ua: navigator.userAgent,
    screen: `${screen.width}x${screen.height}`,
    sessionId,
    events,
  }
}

async function sendEvents(events: TelemetryEvent[]): Promise<void> {
  if (!events.length || !endpoint) return
  const body = JSON.stringify(buildPayload(events))
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body,
      keepalive: true,
    })
  } catch {
    // 上报失败静默丢弃
  }
}

function sendBeacon(events: TelemetryEvent[]): void {
  if (!events.length || !endpoint) return
  const body = JSON.stringify(buildPayload(events))
  // sendBeacon 无法设置 Authorization header，用 fetch keepalive 替代
  try {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body,
      keepalive: true,
    })
  } catch {
    // fallback 失败则丢弃
  }
}

/** 立即上报队列中的事件（未登录时跳过，事件保留到登录后再发） */
export function flushTelemetry(): void {
  if (!queue.length) return
  if (!localStorage.getItem('token')) return
  const batch = queue.splice(0, MAX_BATCH_SIZE)
  sendEvents(batch)
}

// ---- 公开 API ----

/** 采集一条埋点事件 */
export function track(
  type: TelemetryEventType,
  name: string,
  props?: Record<string, unknown>,
): void {
  if (!enabled) return
  const event: TelemetryEvent = {
    type,
    name,
    ts: new Date().toISOString(),
    page: location.pathname + location.hash,
    ...(props ? { props } : {}),
  }
  queue.push(event)
  if (queue.length >= MAX_QUEUE_SIZE) {
    flushTelemetry()
  }
}

/** 便捷：页面浏览 */
export function trackPageView(pageName: string, props?: Record<string, unknown>): void {
  track('page_view', pageName, props)
}

/** 便捷：点击操作 */
export function trackClick(name: string, props?: Record<string, unknown>): void {
  track('click', name, props)
}

/** 便捷：API 调用 */
export function trackApi(name: string, props?: Record<string, unknown>): void {
  track('api_call', name, props)
}

/** 便捷：API 错误 */
export function trackApiError(name: string, props?: Record<string, unknown>): void {
  track('api_error', name, props)
}

/** 便捷：JS 错误 */
export function trackJsError(name: string, props?: Record<string, unknown>): void {
  track('js_error', name, props)
}

// ---- 生命周期 ----

export interface TelemetryOptions {
  /** 上报端点，如 /api/console/telemetry/events */
  endpoint: string
  /** 是否启用，默认 true */
  enabled?: boolean
}

/** 初始化埋点系统（应用启动时调用一次） */
export function initTelemetry(options: TelemetryOptions): void {
  endpoint = options.endpoint
  enabled = options.enabled !== false

  if (!enabled) return

  // 定时批量上报
  if (flushTimer) clearInterval(flushTimer)
  flushTimer = setInterval(flushTelemetry, FLUSH_INTERVAL_MS)

  // 页面关闭 / 隐藏时用 sendBeacon 兜底（未登录不发）
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && queue.length && localStorage.getItem('token')) {
      sendBeacon(queue.splice(0))
    }
  })
  window.addEventListener('beforeunload', () => {
    if (queue.length && localStorage.getItem('token')) {
      sendBeacon(queue.splice(0))
    }
  })
}
