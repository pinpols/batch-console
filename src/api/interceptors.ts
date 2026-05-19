import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { CommonResponse } from '@/types'
import { createIdempotencyKey } from '@/utils/idempotency'
import { setLastApiMeta } from '@/utils/lastApiMeta'
import { logApi } from '@/utils/logger'
import { sanitizeParams, sanitizeRequestBody, sanitizeResponseBody } from '@/utils/logRedact'
import { showErrorToast } from '@/utils/errorToast'
import { i18n } from '@/locales'

/**
 * 把后端 BizException 下发的 i18n key(形如 "error.auth.invalid_credentials")翻成中/英文。
 * 命中 vue-i18n 字典就返回译文,否则原样返回 raw,让上层继续走兜底文案。
 *
 * 触发场景:登录失败 / NOT_FOUND / 幂等 Redis 失联 / 限流等后端直接抛 key 给前端的接口。
 */
function translateBizMessage(raw: string | undefined): string | undefined {
  if (!raw) return raw
  const trimmed = String(raw).trim()
  // 只识别 "error.xxx[.yyy...]" 这种点分 key,普通中英文 message 原样直出
  if (!/^error\.[a-z][a-z0-9_]*(?:\.[a-zA-Z0-9_]+)+$/.test(trimmed)) return raw
  const { t, te } = i18n.global
  return te(trimmed) ? t(trimmed) : raw
}

/**
 * 成功响应只记 envelope 的 `{ code, message }`(通常几十字节),不记 `data`。
 * 失败响应由错误拦截器记完整 body(含后端错误 message、meta.traceId 等)。
 * 非 CommonResponse 形态(直接字符串/数组/null)不记 response 字段。
 */
function summarizeSuccessEnvelope(data: unknown): Record<string, unknown> | undefined {
  if (data == null || typeof data !== 'object') return undefined
  const { code, message } = data as { code?: unknown; message?: unknown }
  if (code === undefined && message === undefined) return undefined
  return {
    ...(code !== undefined ? { code } : {}),
    ...(message !== undefined ? { message } : {}),
  }
}

/** 附加到 axios config 上的内部状态(不会发到后端) */
type LoggedConfig = InternalAxiosRequestConfig & {
  _startTime?: number
  _loggedParams?: unknown
  _loggedRequestBody?: unknown
  /** 重试次数,从 0 开始,最大 RETRY_MAX */
  _retryCount?: number
  /** 401 时已尝试过静默 refresh,避免无限循环 */
  _refreshAttempted?: boolean
  /** 自动生成幂等键时使用的请求签名,供响应阶段收尾短窗口复用。 */
  _autoIdempotencySignature?: string
  /**
   * 调用方主动声明该请求"失败也不弹 toast"。日志、reject、redirect 仍照常,
   * 仅抑制 UI 错误提示。典型场景:登录页挂载时预清 cookie 的 /auth/logout,
   * 失败属预期(cookie 失效)且对用户无意义,不该噪声化体验。
   */
  _silent?: boolean
}

/**
 * 静默 refresh token:401 时调一次 /api/console/auth/token 拿新 JWT,
 * 同时多个请求并发 401 共享一个 refresh promise(去重)。
 * 成功 → 写新 token + 通知调用方 retry 原请求;失败 → 跳登录。
 */
let refreshInFlight: Promise<string | null> | null = null

async function performRefresh(client: AxiosInstance): Promise<string | null> {
  try {
    // D7 Stage B: 后端 /api/console/auth/token 响应会同时下发 HttpOnly cookie，
    // 浏览器自动接收 Set-Cookie；前端不再把 accessToken 写 localStorage。
    // 这里仍然返回字符串供调用方判断"refresh 是否成功"（非空 = 成功）。
    const resp = await client.post('/api/console/auth/token')
    const data = resp.data as { accessToken?: string } | undefined
    return data?.accessToken ?? null
  } catch {
    return null
  }
}

function tryRefreshToken(client: AxiosInstance): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh(client).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/**
 * 重试策略:
 *  - 仅幂等 GET(避免重复 mutation)
 *  - 网络错误(无 response)或 5xx / 429 限流
 *  - 指数退避 + jitter,最大 2 次重试(总 3 次尝试)
 *  - 总耗时上限 ~3.5s,超过用户感受到卡顿就算了
 */
const RETRY_MAX = 2
const RETRY_BASE_DELAY = 500
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])

function isRetryableError(error: AxiosError, cfg?: LoggedConfig): boolean {
  if (!cfg) return false
  const method = (cfg.method ?? 'get').toLowerCase()
  if (method !== 'get') return false
  // 网络错误(超时 / DNS / 断网)无 response,error.code = 'ERR_NETWORK' / 'ECONNABORTED' 等
  if (!error.response) return true
  const status = error.response.status
  return RETRYABLE_STATUS.has(status)
}

function nextRetryDelay(attempt: number): number {
  const exp = RETRY_BASE_DELAY * Math.pow(2, attempt)
  const jitter = Math.random() * 200
  return exp + jitter
}

const TENANT_STORAGE_KEY = 'batch-console-tenant-id'

export function readStoredTenantId(): string {
  return localStorage.getItem(TENANT_STORAGE_KEY) ?? 'default-tenant'
}

function isSuccessCode(code: string | number | undefined): boolean {
  if (code === undefined) return true
  if (typeof code === 'number') return code === 0 || code === 200
  return code === 'SUCCESS' || code === '0' || code === '200'
}

function isTokenExchangeRequest(config?: { url?: string } | null): boolean {
  const u = config?.url ?? ''
  return u.includes('/api/console/auth/login') || u.includes('/api/console/auth/token')
}

/**
 * 只有这些路径的 401 才能判断"session 真正失效"。
 * 业务接口（/triggers、/workers 等）的 401 可能源自后端代理鉴权失败 / RBAC
 * 不足，不应清 token 把用户踢回登录页。
 */
function isSessionAuthRequest(config?: { url?: string } | null): boolean {
  const u = config?.url ?? ''
  return (
    u.includes('/api/console/auth/me') ||
    u.includes('/api/console/auth/token') ||
    u.includes('/api/console/auth/login')
  )
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete'])
const IDEMPOTENCY_REUSE_WINDOW_MS = 2000
const IDEMPOTENCY_PENDING_MAX_MS = 60000
const IDEMPOTENCY_CACHE_MAX = 500

type AutoIdempotencyEntry = {
  key: string
  expiresAt: number
  pendingUntil: number
  activeCount: number
}

const autoIdempotencyKeys = new Map<string, AutoIdempotencyEntry>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value != null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
  )
}

function normalizeFormDataValue(value: FormDataEntryValue): unknown {
  if (typeof File !== 'undefined' && value instanceof File) {
    return {
      kind: 'file',
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    }
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { kind: 'blob', size: value.size, type: value.type }
  }
  return value
}

function normalizeForIdempotency(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => normalizeForIdempotency(item))
  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
    return Array.from(value.entries()).sort(([a], [b]) => a.localeCompare(b))
  }
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return Array.from(value.entries())
      .map(([key, entry]) => [key, normalizeFormDataValue(entry)] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  }
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForIdempotency(value[key])
        return acc
      }, {})
  }
  return String(value)
}

function stableStringifyForIdempotency(value: unknown): string {
  try {
    return JSON.stringify(normalizeForIdempotency(value))
  } catch {
    return String(value)
  }
}

function pruneAutoIdempotencyKeys(now = Date.now()): void {
  for (const [signature, entry] of autoIdempotencyKeys) {
    if (now > entry.expiresAt && now > entry.pendingUntil) {
      autoIdempotencyKeys.delete(signature)
    }
  }
  while (autoIdempotencyKeys.size > IDEMPOTENCY_CACHE_MAX) {
    const oldest = autoIdempotencyKeys.keys().next().value
    if (!oldest) break
    autoIdempotencyKeys.delete(oldest)
  }
}

function resolveMutationSignature(
  config: InternalAxiosRequestConfig,
  method: string,
  tenantId: string,
): string {
  return [
    method,
    config.baseURL ?? '',
    config.url ?? '',
    tenantId,
    stableStringifyForIdempotency(config.params),
    stableStringifyForIdempotency(config.data),
  ].join('\n')
}

function getAutoIdempotencyKey(signature: string): string {
  const now = Date.now()
  pruneAutoIdempotencyKeys(now)
  const existing = autoIdempotencyKeys.get(signature)
  if (existing && (now <= existing.pendingUntil || now <= existing.expiresAt)) {
    existing.activeCount += 1
    return existing.key
  }
  const key = createIdempotencyKey()
  autoIdempotencyKeys.set(signature, {
    key,
    expiresAt: now + IDEMPOTENCY_REUSE_WINDOW_MS,
    pendingUntil: now + IDEMPOTENCY_PENDING_MAX_MS,
    activeCount: 1,
  })
  return key
}

function markAutoIdempotencyCompleted(config?: LoggedConfig): void {
  const signature = config?._autoIdempotencySignature
  if (!signature) return
  const entry = autoIdempotencyKeys.get(signature)
  if (!entry) return
  entry.activeCount = Math.max(0, entry.activeCount - 1)
  if (entry.activeCount === 0) {
    entry.expiresAt = Date.now() + IDEMPOTENCY_REUSE_WINDOW_MS
    entry.pendingUntil = 0
  }
}

type SpringLikeErrorBody = {
  message?: string
  error?: string
  path?: string
}

function extractHttpErrorMessage(error: unknown): string {
  const ax = error as AxiosError<SpringLikeErrorBody | string>
  const code = (ax as AxiosError & { code?: string }).code
  if (
    !ax.response &&
    (code === 'ECONNREFUSED' || code === 'ERR_NETWORK' || /Network Error/i.test(String(ax.message)))
  ) {
    const target = import.meta.env.VITE_DEV_PROXY_TARGET || 'http://localhost:18080'
    if (import.meta.env.DEV) {
      return `无法连接后端（代理目标 ${target}）。请确认服务已启动，或与 VITE_DEV_PROXY_TARGET 一致。`
    }
    return '网络不可达或服务未响应，请稍后重试。'
  }
  const status = ax.response?.status
  const d = ax.response?.data
  if (d && typeof d === 'object') {
    // Spring Boot 3 默认 404 message（映射不到 controller 时落到静态资源处理器）
    // 例：`No static resource api/console/triggers for request '/api/console/triggers'.`
    // 这类信息对用户不友好，统一改成“接口不存在/版本不匹配”。
    if (status === 404 && typeof d.message === 'string' && /No static resource/i.test(d.message)) {
      const url = ax.config?.url || d.path
      return url ? `接口不存在或后端版本不匹配（${url}）` : '接口不存在或后端版本不匹配'
    }
    const parts: string[] = []
    if (d.message) parts.push(translateBizMessage(String(d.message)) ?? String(d.message))
    if (d.error && String(d.error) !== String(d.message)) parts.push(String(d.error))
    if (d.path) parts.push(`(${String(d.path)})`)
    if (parts.length) return parts.join(' ')
  }
  if (typeof d === 'string' && d.trim()) return d.trim().slice(0, 400)
  if (status) return `请求失败（HTTP ${status}）`
  return ax.message || '网络异常'
}

function extractErrorTrace(error: unknown): string | undefined {
  const ax = error as AxiosError<CommonResponse<unknown> | SpringLikeErrorBody>
  const d = ax.response?.data
  if (d && typeof d === 'object' && 'meta' in d) {
    const meta = (d as CommonResponse<unknown>).meta
    const t = meta?.traceId || meta?.requestId
    if (t) return String(t)
  }
  return undefined
}

function showApiErrorToast(message: string, error?: unknown) {
  const trace = error !== undefined ? extractErrorTrace(error) : undefined
  showErrorToast({
    title: '请求失败',
    message,
    traceId: trace,
  })
}

export function applyApiInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }

    // D7 Stage B: HttpOnly cookie 由浏览器自动随请求带，不再注入 Authorization header。
    // (后端 ConsoleAuthenticationFilter 优先读 cookie，header fallback 也仍兼容老客户端)
    // 2026-05-16:后端 Set-Cookie 已落地,dev fallback 已删,前端纯 cookie 路径生效。

    const tenantId = readStoredTenantId()
    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId
    }

    // 后端 /meta/enums 可按 Accept-Language 返回不同语言 label;FE 缺失 i18n key 时
    // 用 BE label 兜底。读 localStorage 而不是 vue-i18n 实例,避免请求拦截器在
    // i18n init 之前触发(token-refresh / SSE init 等)时拿不到 locale。
    const locale =
      (typeof localStorage !== 'undefined' && localStorage.getItem('batch-console:locale')) ||
      'zh-CN'
    config.headers['Accept-Language'] = locale === 'en-US' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9'

    const loggable = config as LoggedConfig
    const method = (config.method ?? 'get').toLowerCase()
    if (MUTATING.has(method) && !config.headers['Idempotency-Key']) {
      const signature = resolveMutationSignature(config, method, tenantId)
      config.headers['Idempotency-Key'] = getAutoIdempotencyKey(signature)
      loggable._autoIdempotencySignature = signature
    }

    // 记录请求发起时间 + 脱敏后的 params/body,供响应 / 错误拦截器写日志
    loggable._startTime = Date.now()
    loggable._loggedParams = sanitizeParams(config.params)
    loggable._loggedRequestBody = sanitizeRequestBody(config.data)

    return config
  })

  client.interceptors.response.use(
    (response) => {
      const cfg = response.config as LoggedConfig
      markAutoIdempotencyCompleted(cfg)
      const duration = cfg._startTime ? Date.now() - cfg._startTime : undefined
      const method = (cfg.method ?? 'get').toUpperCase()
      const url = cfg.url ?? ''
      const isBlob = response.config.responseType === 'blob'
      // 成功路径:response 只留 envelope 的 code/message(必要时可从后端 meta 拿 traceId),
      // 不拖 data 字段,防止列表接口一次性塞几 KB。失败路径(error 分支)仍记完整 body。
      let responseField: unknown
      if (isBlob) {
        responseField = `[Blob responseType,${response.headers['content-length'] ?? '?'} bytes]`
      } else {
        responseField = summarizeSuccessEnvelope(response.data)
      }
      logApi(`${method} ${url} → ${response.status}`, 'info', {
        kind: 'api',
        method,
        url,
        status: response.status,
        ...(duration != null ? { durationMs: duration } : {}),
        ...(cfg._loggedParams !== undefined ? { params: cfg._loggedParams } : {}),
        ...(cfg._loggedRequestBody !== undefined ? { request: cfg._loggedRequestBody } : {}),
        ...(responseField !== undefined ? { response: responseField } : {}),
      })

      if (isBlob) {
        return response
      }

      const body = response.data as CommonResponse | unknown
      if (
        body &&
        typeof body === 'object' &&
        'code' in body &&
        'data' in body &&
        'message' in body
      ) {
        const envelope = body as CommonResponse<unknown>
        setLastApiMeta(envelope.meta ?? null)
        if (!isSuccessCode(envelope.code as string | number)) {
          const msg = translateBizMessage(envelope.message) || envelope.message || '请求失败'
          const tid = envelope.meta?.traceId || envelope.meta?.requestId
          showErrorToast({
            title: '请求失败',
            message: msg,
            traceId: tid ? String(tid) : undefined,
          })
          return Promise.reject(
            Object.assign(new Error(msg), {
              traceId: envelope.meta?.traceId,
              requestId: envelope.meta?.requestId,
            }),
          )
        }
        response.data = envelope.data
      }

      return response
    },
    async (error) => {
      const status = error.response?.status as number | undefined
      const cfg = error.config as LoggedConfig | undefined
      markAutoIdempotencyCompleted(cfg)
      const raw = error.response?.data

      // L2/L3 协同的"幂等重放"识别:
      //   FE 在 2s 复用窗口里给同签名重发请求时复用了同一个 Idempotency-Key,
      //   BE 幂等拦截器看到重复 key → 409。这本质是 FE 自己防抖的副作用,
      //   不是用户该被打扰的错误,这里:
      //     - 不写 error 级别日志,改 info(留痕但不污染告警)
      //     - 不弹 toast(主防线 useAsyncAction.loading 已让用户根本点不到,
      //       走到这层一定是漏了 :loading 或非按钮触发的二次写)
      //     - 仍 reject,把 idempotentReplay 标记挂到 error 上,业务方有需要可识别
      //   触发条件二选一即可:
      //     (a) FE 本次自动注入了 key(_autoIdempotencySignature 非空),即用户在
      //         FE 的复用窗口内重复点击 — 这是 FE 自己造的重发,理应静默;
      //     (b) BE envelope.code === 'IDEMPOTENT_REPLAY'(BE 协议未来若加此明示码),
      //         即便 FE 没自动注入 key(例如调用方手写 header),BE 已确认这是重放
      //         也按静默处理 — 比纯依赖 (a) 更稳。
      //   双信号互补:任一命中即静默,都不命中(真冲突)走正常错误路径。
      const replayEnvelopeCode =
        raw && typeof raw === 'object' && 'code' in raw
          ? String((raw as { code?: unknown }).code ?? '')
          : ''
      const idempotentReplay =
        status === 409 &&
        (!!cfg?._autoIdempotencySignature || replayEnvelopeCode === 'IDEMPOTENT_REPLAY')
      if (idempotentReplay) {
        logApi(
          `${(cfg!.method ?? 'get').toUpperCase()} ${cfg!.url ?? ''} → 409 idempotent replay (silenced)`,
          'info',
          {
            kind: 'api-idempotent-replay',
            method: (cfg!.method ?? 'get').toUpperCase(),
            url: cfg!.url ?? '',
            status,
          },
        )
        return Promise.reject(
          Object.assign(error as object, { idempotentReplay: true, silenced: true }),
        )
      }

      {
        const duration = cfg?._startTime ? Date.now() - cfg._startTime : undefined
        const method = (cfg?.method ?? 'get').toUpperCase()
        const url = cfg?.url ?? ''
        const meta =
          raw && typeof raw === 'object' && 'meta' in raw
            ? (raw as CommonResponse<unknown>).meta
            : undefined
        const axErr = error as AxiosError & { code?: string }
        logApi(`${method} ${url} → ${status ?? 'ERR'}`, 'error', {
          kind: 'api',
          method,
          url,
          status,
          error: extractHttpErrorMessage(error),
          ...(duration != null ? { durationMs: duration } : {}),
          ...(meta?.traceId ? { traceId: meta.traceId } : {}),
          ...(meta?.requestId ? { requestId: meta.requestId } : {}),
          ...(axErr.code ? { errorCode: axErr.code } : {}),
          ...(cfg?._loggedParams !== undefined ? { params: cfg._loggedParams } : {}),
          ...(cfg?._loggedRequestBody !== undefined ? { request: cfg._loggedRequestBody } : {}),
          ...(raw !== undefined ? { response: sanitizeResponseBody(raw) } : {}),
        })
      }
      if (raw && typeof raw === 'object' && 'meta' in raw) {
        setLastApiMeta((raw as CommonResponse<unknown>).meta ?? null)
      }

      // 维护模式 503:BE MaintenanceModeFilter 返 {maintenance:true, readOnly, message, etaAt} +
      // X-Maintenance header。识别到就把状态写进 appStore,后续 banner / 写按钮禁用 / 跳降级页
      // 由 UI 层消费;此处不弹通用错误 toast,避免一堆 503 提示淹没用户视线。
      if (status === 503) {
        const maint = raw as
          | { maintenance?: boolean; readOnly?: boolean; message?: string; etaAt?: string }
          | undefined
        const xMaint = error.response?.headers?.['x-maintenance']
        if (maint?.maintenance === true || xMaint) {
          // 动态 import 避开循环依赖(interceptors → store → api → interceptors)
          void import('@/stores/app').then(({ useAppStore }) => {
            const app = useAppStore()
            app.setMaintenance({
              enabled: true,
              readOnly: !!maint?.readOnly || xMaint === 'read-only',
              message: maint?.message ?? null,
              etaAt: maint?.etaAt ?? null,
            })
          })
          return Promise.reject(
            Object.assign(error as object, { maintenance: true, silenced: true }),
          )
        }
      }

      // 幂等 GET 在网络错 / 5xx / 429 时静默重试(指数退避),用户感知不到瞬时抖动
      const retryCount = cfg?._retryCount ?? 0
      if (cfg && retryCount < RETRY_MAX && isRetryableError(error as AxiosError, cfg)) {
        cfg._retryCount = retryCount + 1
        const delay = nextRetryDelay(retryCount)
        logApi(`retry ${retryCount + 1}/${RETRY_MAX} in ${Math.round(delay)}ms`, 'warn', {
          kind: 'api-retry',
          method: (cfg.method ?? 'get').toUpperCase(),
          url: cfg.url ?? '',
          status,
          attempt: retryCount + 1,
        })
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            client.request(cfg).then(resolve).catch(reject)
          }, delay)
        })
      }

      const silent = cfg?._silent === true
      if (silent) {
        return Promise.reject(error)
      }

      if (status === 401) {
        if (isTokenExchangeRequest(cfg)) {
          // 登录 / 刷 token 本身 401：用户名密码错 或 refresh 失败，提示不登出
          const rawMsg =
            raw && typeof raw === 'object' && 'message' in raw
              ? String((raw as CommonResponse<unknown>).message || '')
              : ''
          const msg = translateBizMessage(rawMsg) || rawMsg
          showApiErrorToast(msg || '用户名或密码错误')
        } else if (isSessionAuthRequest(cfg)) {
          // /auth/me 401：session 真正失效 → 清登录 flag 跳登录
          // (HttpOnly cookie 由后端 max-age=0 或服务端 token 已过期；前端只需清 UI flag)
          localStorage.removeItem('batch-console-session')
          window.location.href = '/login'
        } else if (cfg && !cfg._refreshAttempted) {
          // 业务接口 401:先静默 refresh 一次,成功则 retry 原请求。
          // refresh 失败 ≠ session 一定过期(可能是后端 RBAC 不足、refresh 端点限流等);
          // 真正的 session 失效由后续 /auth/me 401 路径处理,这里只 toast 不踢人,
          // 避免单个权限不足的接口把整个会话清掉(典型如 SchedulerSnapshot:
          // 后端 @PreAuthorize 比路由 minRole 严)。
          cfg._refreshAttempted = true
          const newToken = await tryRefreshToken(client)
          if (newToken) {
            // 用新 token 重发(cookie 已被后端 Set-Cookie 更新，浏览器自动带最新值)
            return client.request(cfg)
          }
          const msg = extractHttpErrorMessage(error) || '该操作未授权'
          showErrorToast({
            title: '未授权',
            message: msg,
            traceId: extractErrorTrace(error),
          })
        } else {
          // 已尝试过 refresh 仍 401:权限真不够 / 接口 RBAC 限制,不登出,toast 提示
          const msg = extractHttpErrorMessage(error) || '该操作未授权'
          showErrorToast({
            title: '未授权',
            message: msg,
            traceId: extractErrorTrace(error),
          })
        }
      } else if (status === 403) {
        showErrorToast({
          title: '权限不足',
          message: '你没有访问该功能的权限。',
          traceId: extractErrorTrace(error),
        })
      } else {
        const msg = extractHttpErrorMessage(error)
        if (import.meta.env.DEV && status != null && status >= 500) {
          const cfg = error.config
          const m = (cfg?.method ?? 'get').toUpperCase()
          const path = cfg?.url ? `${cfg.baseURL ?? ''}${cfg.url}` : ''
          console.error('[API]', m, path, status, raw)
        }
        if (status === 400 && /Required request parameter 'jobCode'/i.test(msg)) {
          const m = (cfg?.method ?? 'get').toUpperCase()
          const url = cfg?.url ?? (error as AxiosError)?.config?.url
          showErrorToast({
            title: '参数缺失（jobCode）',
            message: url
              ? `接口要求必填参数 jobCode，但本次请求未携带。请检查该页面的查询条件/路由参数是否传了 jobCode。\n${m} ${url}`
              : `接口要求必填参数 jobCode，但本次请求未携带。请检查该页面的查询条件/路由参数是否传了 jobCode。`,
            traceId: extractErrorTrace(error),
            duration: 7500,
          })
        } else if (status === 404) {
          // 区分两类 404:
          //   a) 后端 BizException(NOT_FOUND) — 路由 OK,但资源(分区/实例/租户)不存在,
          //      响应体形如 { code:"NOT_FOUND", message:"partition not found", data:null }。
          //      这种应该把领域 message 直接展示给用户,不是吓人的"接口不存在"。
          //   b) Spring 默认 404(No static resource) — 路由真的没注册,
          //      由 extractHttpErrorMessage() 改写为「接口不存在或后端版本不匹配(...)」。
          const body = (error as AxiosError)?.response?.data as
            | { code?: unknown; message?: unknown; data?: unknown }
            | undefined
          const isBizNotFound =
            body != null &&
            typeof body === 'object' &&
            typeof body.code === 'string' &&
            body.code.length > 0 &&
            'data' in body
          if (isBizNotFound) {
            showErrorToast({
              title: '资源不存在',
              message: msg || '请求的资源在后端未找到。',
              traceId: extractErrorTrace(error),
            })
          } else {
            const url = (error as AxiosError)?.config?.url
            showErrorToast({
              title: '接口不存在',
              message: url
                ? `后端未提供该接口或版本不匹配：${url}。请确认后端已部署最新版本，并检查代理/网关路由配置。`
                : `后端未提供该接口或版本不匹配。请确认后端已部署最新版本，并检查代理/网关路由配置。`,
              traceId: extractErrorTrace(error),
              duration: 7500,
            })
          }
        } else {
          showErrorToast({
            title: status ? `请求失败（HTTP ${status}）` : '请求失败',
            message: msg,
            traceId: extractErrorTrace(error),
          })
        }
      }
      return Promise.reject(error)
    },
  )
}
