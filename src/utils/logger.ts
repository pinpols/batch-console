/**
 * 前端操作日志系统
 *
 * - 环形缓冲区存最近 N 条日志，超出自动淘汰最旧记录
 * - 定期持久化到 localStorage，页面刷新不丢失
 * - 登录后定时上报后端 /api/console/telemetry/events
 * - 分类：route（路由切换）、click（按钮/操作点击）、api（接口调用）、error（异常）
 */

export type LogCategory = 'route' | 'click' | 'api' | 'error'
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  /** 自增序号 */
  id: number
  /** ISO 时间戳 */
  ts: string
  /** 日志分类 */
  category: LogCategory
  /** 日志级别 */
  level: LogLevel
  /** 摘要 */
  message: string
  /** 附加结构化数据 */
  detail?: Record<string, unknown>
}

const STORAGE_KEY = 'batch-console-oplog'
const MAX_ENTRIES = 500
const FLUSH_INTERVAL_MS = 10_000 // 10s 落盘一次
const UPLOAD_INTERVAL_MS = 15_000 // 15s 上报一次
const UPLOAD_BATCH_SIZE = 50
const TELEMETRY_ENDPOINT = '/api/console/telemetry/events'
const APP_NAME = 'batch-console'

let seq = 0
let buffer: LogEntry[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let uploadTimer: ReturnType<typeof setInterval> | null = null
let lastUploadedSeq = 0
let uploadInFlight = false

// ---- 核心 API ----

function push(
  category: LogCategory,
  level: LogLevel,
  message: string,
  detail?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    id: ++seq,
    ts: new Date().toISOString(),
    category,
    level,
    message,
    ...(detail !== undefined ? { detail } : {}),
  }
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) {
    buffer = buffer.slice(buffer.length - MAX_ENTRIES)
  }
}

/** 写入一条路由日志 */
export function logRoute(message: string, detail?: Record<string, unknown>) {
  push('route', 'info', message, detail)
}

/** 写入一条点击/操作日志 */
export function logClick(message: string, detail?: Record<string, unknown>) {
  push('click', 'info', message, detail)
}

/** 写入一条 API 日志 */
export function logApi(message: string, level: LogLevel, detail?: Record<string, unknown>) {
  push('api', level, message, detail)
}

/** 写入一条错误日志 */
export function logError(message: string, detail?: Record<string, unknown>) {
  push('error', 'error', message, detail)
}

// ---- 查询 ----

/** 获取所有日志（返回副本） */
export function getLogs(): LogEntry[] {
  return [...buffer]
}

/** 按条件过滤日志 */
export function queryLogs(filter?: {
  category?: LogCategory
  level?: LogLevel
  keyword?: string
  since?: string
}): LogEntry[] {
  let result = buffer
  if (filter?.category) {
    result = result.filter((e) => e.category === filter.category)
  }
  if (filter?.level) {
    result = result.filter((e) => e.level === filter.level)
  }
  if (filter?.keyword) {
    const kw = filter.keyword.toLowerCase()
    result = result.filter(
      (e) =>
        e.message.toLowerCase().includes(kw) ||
        (e.detail && JSON.stringify(e.detail).toLowerCase().includes(kw)),
    )
  }
  if (filter?.since) {
    result = result.filter((e) => e.ts >= filter.since!)
  }
  return [...result]
}

/** 清空日志 */
export function clearLogs() {
  buffer = []
  seq = 0
  lastUploadedSeq = 0
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* quota / private mode */
  }
}

// ---- 持久化 ----

/** 立即落盘到 localStorage */
export function flushLogs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seq, entries: buffer }))
  } catch {
    if (buffer.length > 200) {
      buffer = buffer.slice(buffer.length - 200)
    }
  }
}

/** 从 localStorage 恢复日志 */
function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as { seq?: number; entries?: LogEntry[] }
    if (Array.isArray(data.entries)) {
      buffer = data.entries.slice(-MAX_ENTRIES)
      seq = typeof data.seq === 'number' ? data.seq : buffer.length
    }
  } catch {
    /* corrupted → start fresh */
  }
}

// ---- 后端上报 ----

/** 将未上报的日志批量发送到后端（未登录时跳过） */
async function uploadPendingLogs() {
  if (uploadInFlight) return
  const token = localStorage.getItem('token')
  if (!token) return
  const pending = buffer.filter((e) => e.id > lastUploadedSeq)
  if (pending.length === 0) return
  const chunk = pending.slice(0, UPLOAD_BATCH_SIZE)
  const events = chunk.map((e) => ({
    type: e.category,
    name: e.message,
    ts: e.ts,
    level: e.level,
    ...(e.detail ? { detail: e.detail } : {}),
  }))
  uploadInFlight = true
  try {
    const tenantId = localStorage.getItem('batch-console-tenant-id') ?? ''
    const res = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      },
      body: JSON.stringify({ app: APP_NAME, events }),
      credentials: 'same-origin',
    })
    if (res.ok) {
      lastUploadedSeq = chunk[chunk.length - 1].id
    }
  } catch {
    /* 网络失败：保留 lastUploadedSeq，下次重试 */
  } finally {
    uploadInFlight = false
  }
}

// ---- 生命周期 ----

/** 初始化日志系统（应用启动时调用一次） */
export function initLogger() {
  restore()

  // 定时落盘 localStorage
  if (flushTimer) clearInterval(flushTimer)
  flushTimer = setInterval(flushLogs, FLUSH_INTERVAL_MS)

  // 定时上报后端
  if (uploadTimer) clearInterval(uploadTimer)
  uploadTimer = setInterval(() => {
    void uploadPendingLogs()
  }, UPLOAD_INTERVAL_MS)

  // 页面关闭前落盘
  window.addEventListener('beforeunload', flushLogs)

  push('route', 'info', '日志系统已初始化')
}

/** 导出日志为 JSON 文本（供排障下载） */
export function exportLogsAsJson(): string {
  return JSON.stringify(buffer, null, 2)
}
