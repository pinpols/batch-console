/**
 * 前端操作日志 —— 唯一的埋点入口(telemetry.ts 已废弃并删除)。
 *
 * 设计目标:
 *  - 本地环形缓冲区 500 条;localStorage 兜底,刷新不丢
 *  - 10s 落盘、15s 批量上报 `/api/console/telemetry/events`
 *  - **schema 严格对齐后端 OpenAPI `receiveTelemetryEvents`**:
 *     { app, userId?, sessionId?, events: [{ type, name, ts, page?, props? }] }
 *  - `type` 只用后端声明的 4 种:`route | click | api | error`
 *  - API 错误(status ≥ 400 / 网络错)上报为 `type: 'error'`,后端直接打 ERROR 级
 *  - 过滤已知 benign 错误(ResizeObserver 等),不污染 console 与后端日志
 *  - 错误事件尽量保留排障所需的所有上下文:method、url、status、traceId、requestId、stack
 */

/** 对齐后端 OpenAPI:4 种事件类型 */
export type LogType = 'route' | 'click' | 'api' | 'error'
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  /** 自增序号(本地排重用) */
  id: number
  /** ISO 时间戳 */
  ts: string
  /** 后端 schema 的 4 种 type */
  type: LogType
  /** 本地过滤/展示用;不发给后端 */
  level: LogLevel
  /** 事件名(短文案:"页面切换:XXX" / "POST /api/xxx → 500") */
  name: string
  /** 触发时所在路由 path+hash */
  page: string
  /** 结构化上下文(业务 id、状态码、stack 等) */
  props?: Record<string, unknown>
}

const STORAGE_KEY = 'batch-console-oplog'
const MAX_ENTRIES = 500
const FLUSH_INTERVAL_MS = 10_000
const UPLOAD_INTERVAL_MS = 15_000
const UPLOAD_BATCH_SIZE = 50
const TELEMETRY_ENDPOINT = '/api/console/telemetry/events'
const APP_NAME = 'batch-console'
const TOKEN_STORAGE_KEY = 'token'
const TENANT_STORAGE_KEY = 'batch-console-tenant-id'

/** 已知 benign 错误 —— 不进 buffer,不上报,不刷 UI */
const IGNORED_ERROR_PATTERNS: readonly RegExp[] = [
  /ResizeObserver loop (limit exceeded|completed with undelivered)/i,
  /Non-Error promise rejection captured/i,
  /^Script error\.?$/, // 跨域脚本,没 stack 也没法排障
]

/**
 * 总开关：默认关闭。
 * - 构建期：`VITE_TELEMETRY_ENABLED=true` 时启用
 * - 运行期：localStorage 设置 `batch-console-telemetry=on` 可临时打开（排障用）
 *
 * 关闭时所有 log* / initLogger / unload 上报全部 no-op，不写 buffer、不起定时器、
 * 不注册 beforeunload 监听 —— 避免 `Failed to fetch` 类卸载竞态噪音。
 */
const TELEMETRY_TOGGLE_KEY = 'batch-console-telemetry'

function isTelemetryEnabled(): boolean {
  try {
    const override = localStorage.getItem(TELEMETRY_TOGGLE_KEY)
    if (override === 'on') return true
    if (override === 'off') return false
  } catch {
    /* private mode / quota */
  }
  return import.meta.env?.VITE_TELEMETRY_ENABLED === 'true'
}

/** tab 级 session ID,整个页面生命周期不变 */
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let seq = 0
let buffer: LogEntry[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let uploadTimer: ReturnType<typeof setInterval> | null = null
let lastUploadedSeq = 0
let uploadInFlight = false

// ────────────────────────────────────────────── 环境信息

function currentPage(): string {
  return typeof location !== 'undefined' ? location.pathname + location.hash : ''
}

/** base64url(JWT 用)→ binary string,比 atob 更耐受 `-` 与 `_` */
function base64UrlDecode(s: string): string {
  const pad = s.length % 4
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '')
  if (typeof atob !== 'undefined') return atob(b64)
  // node 环境兜底
  return Buffer.from(b64, 'base64').toString('binary')
}

function currentUserId(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) return null
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>
    const sub = payload.sub ?? payload.userId
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}

function currentTenantId(): string | null {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY) || null
  } catch {
    return null
  }
}

function isIgnoredError(name: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(name))
}

// ────────────────────────────────────────────── 核心 API

function push(type: LogType, level: LogLevel, name: string, props?: Record<string, unknown>): void {
  if (!isTelemetryEnabled()) return
  if (type === 'error' && isIgnoredError(name)) return
  const entry: LogEntry = {
    id: ++seq,
    ts: new Date().toISOString(),
    type,
    level,
    name,
    page: currentPage(),
    ...(props && Object.keys(props).length ? { props } : {}),
  }
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) {
    buffer = buffer.slice(buffer.length - MAX_ENTRIES)
  }
}

/** 路由切换 */
export function logRoute(name: string, props?: Record<string, unknown>): void {
  push('route', 'info', name, props)
}

/** 按钮/操作点击 */
export function logClick(name: string, props?: Record<string, unknown>): void {
  push('click', 'info', name, props)
}

/**
 * API 事件。成功走 `type: 'api'`(后端 INFO);失败走 `type: 'error'`(后端 ERROR,便于告警)。
 * level 仅用于本地 UI 过滤,不影响后端分级(后端从 `type` 决定 log level)。
 */
export function logApi(name: string, level: LogLevel, props?: Record<string, unknown>): void {
  const type: LogType = level === 'error' || level === 'warn' ? 'error' : 'api'
  push(type, level, name, props)
}

/** JS 运行时/Promise/Vue 组件异常 */
export function logError(name: string, props?: Record<string, unknown>): void {
  push('error', 'error', name, props)
}

// ────────────────────────────────────────────── 查询 / 导出

export function getLogs(): LogEntry[] {
  return [...buffer]
}

export function queryLogs(filter?: {
  type?: LogType
  level?: LogLevel
  keyword?: string
  since?: string
}): LogEntry[] {
  let result = buffer
  if (filter?.type) {
    result = result.filter((e) => e.type === filter.type)
  }
  if (filter?.level) {
    result = result.filter((e) => e.level === filter.level)
  }
  if (filter?.keyword) {
    const kw = filter.keyword.toLowerCase()
    result = result.filter(
      (e) =>
        e.name.toLowerCase().includes(kw) ||
        (e.props != null && JSON.stringify(e.props).toLowerCase().includes(kw)),
    )
  }
  if (filter?.since) {
    result = result.filter((e) => e.ts >= filter.since!)
  }
  return [...result]
}

export function clearLogs(): void {
  buffer = []
  seq = 0
  lastUploadedSeq = 0
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* quota / private mode */
  }
}

export function exportLogsAsJson(): string {
  return JSON.stringify(buffer, null, 2)
}

// ────────────────────────────────────────────── 持久化

export function flushLogs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seq, entries: buffer }))
  } catch {
    // quota exceeded:砍掉一半再试一次,仍失败则放弃
    if (buffer.length > 200) {
      buffer = buffer.slice(buffer.length - 200)
    }
  }
}

function restore(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as { seq?: number; entries?: LogEntry[] }
    if (Array.isArray(data.entries)) {
      buffer = data.entries.slice(-MAX_ENTRIES)
      seq = typeof data.seq === 'number' ? data.seq : buffer.length
    }
  } catch {
    /* 坏数据 → 丢弃从头开始 */
  }
}

// ────────────────────────────────────────────── 后端上报

interface TelemetryPayload {
  app: string
  userId?: string
  sessionId?: string
  events: Array<{
    type: LogType
    name: string
    ts?: string
    page?: string
    props?: Record<string, unknown>
  }>
}

/** 后端 FrontendTelemetryRequest 的字段长度上限（Bean Validation @Size） */
const MAX_APP_LEN = 50
const MAX_TYPE_LEN = 20
const MAX_NAME_LEN = 200

function clip(value: string | undefined, max: number): string {
  if (!value) return ''
  return value.length > max ? value.slice(0, max) : value
}

function buildPayload(entries: LogEntry[]): TelemetryPayload {
  const uid = currentUserId()
  return {
    app: clip(APP_NAME, MAX_APP_LEN),
    ...(uid ? { userId: uid } : {}),
    sessionId: SESSION_ID,
    // 过滤 + 截断：后端 @NotBlank/@Size 若单条不合规会拒整批，
    // 导致 lastUploadedSeq 永不前进、所有后续日志也卡死。
    events: entries
      .filter((e) => e.type && e.name)
      .map((e) => ({
        type: clip(e.type, MAX_TYPE_LEN) as LogType,
        name: clip(e.name, MAX_NAME_LEN),
        ts: e.ts,
        ...(e.page ? { page: e.page } : {}),
        ...(e.props ? { props: e.props } : {}),
      })),
  }
}

async function uploadPendingLogs(): Promise<void> {
  if (uploadInFlight) return
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!token) return // 未登录期间暂不发,留在 buffer 登录后补发
  const pending = buffer.filter((e) => e.id > lastUploadedSeq)
  if (pending.length === 0) return
  const chunk = pending.slice(0, UPLOAD_BATCH_SIZE)
  const lastId = chunk[chunk.length - 1].id
  const payload = buildPayload(chunk)
  // 全部被过滤：直接前进游标，避免这批永远卡住
  if (payload.events.length === 0) {
    lastUploadedSeq = lastId
    return
  }
  uploadInFlight = true
  try {
    const tenantId = currentTenantId() ?? ''
    const res = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      keepalive: true,
    })
    // 200 正常前进；4xx 是客户端问题（字段格式/认证），重传也不会成功，丢掉避免永久卡死；
    // 5xx / 网络失败：保留游标，下轮再试
    if (res.ok) {
      lastUploadedSeq = lastId
    } else if (res.status >= 400 && res.status < 500) {
      if (import.meta.env.DEV) {
        console.warn(
          `[logger] telemetry rejected (${res.status}); dropping ${chunk.length} entries`,
        )
      }
      lastUploadedSeq = lastId
    }
  } catch {
    /* 网络失败:保留 lastUploadedSeq,下轮再试 */
  } finally {
    uploadInFlight = false
  }
}

function flushUploadOnUnload(): void {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!token) return
  const pending = buffer.filter((e) => e.id > lastUploadedSeq)
  if (pending.length === 0) return
  const chunk = pending.slice(0, UPLOAD_BATCH_SIZE)
  try {
    fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(currentTenantId() ? { 'X-Tenant-Id': currentTenantId()! } : {}),
      },
      body: JSON.stringify(buildPayload(chunk)),
      credentials: 'same-origin',
      keepalive: true,
    })
    lastUploadedSeq = chunk[chunk.length - 1].id
  } catch {
    /* 页面即将卸载,失败无所谓 */
  }
}

// ────────────────────────────────────────────── 生命周期

export function initLogger(): void {
  if (!isTelemetryEnabled()) {
    // 开关关闭：清掉历史 buffer 并不起任何定时器 / 监听器
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    if (uploadTimer) {
      clearInterval(uploadTimer)
      uploadTimer = null
    }
    return
  }
  restore()

  if (flushTimer) clearInterval(flushTimer)
  flushTimer = setInterval(flushLogs, FLUSH_INTERVAL_MS)

  if (uploadTimer) clearInterval(uploadTimer)
  uploadTimer = setInterval(() => {
    void uploadPendingLogs()
  }, UPLOAD_INTERVAL_MS)

  if (typeof window !== 'undefined') {
    // 页面隐藏/关闭时:落盘 + 兜底上报(keepalive fetch,浏览器会后台完成)
    window.addEventListener('visibilitychange', () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        flushLogs()
        flushUploadOnUnload()
      }
    })
    window.addEventListener('beforeunload', () => {
      flushLogs()
      flushUploadOnUnload()
    })
  }

  push('route', 'info', '日志系统已初始化')
}
