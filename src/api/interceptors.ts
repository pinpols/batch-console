import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { CommonResponse } from '@/types'
import { createIdempotencyKey } from '@/utils/idempotency'
import { setLastApiMeta } from '@/utils/lastApiMeta'
import { logApi } from '@/utils/logger'
import { sanitizeParams, sanitizeRequestBody, sanitizeResponseBody } from '@/utils/logRedact'

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
    const parts: string[] = []
    if (d.message) parts.push(String(d.message))
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
  const text = trace && !message.includes(trace) ? `${message}（trace：${trace}）` : message
  ElMessage.error({
    message: text,
    duration: trace ? 6500 : 4000,
    showClose: true,
  })
}

export function applyApiInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    if (config.responseType === 'blob') {
      return config
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }

    const token = localStorage.getItem('token')
    if (token && !isTokenExchangeRequest(config)) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const tenantId = readStoredTenantId()
    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId
    }

    const method = (config.method ?? 'get').toLowerCase()
    if (MUTATING.has(method) && !config.headers['Idempotency-Key']) {
      config.headers['Idempotency-Key'] = createIdempotencyKey()
    }

    // 记录请求发起时间 + 脱敏后的 params/body,供响应 / 错误拦截器写日志
    const loggable = config as LoggedConfig
    loggable._startTime = Date.now()
    loggable._loggedParams = sanitizeParams(config.params)
    loggable._loggedRequestBody = sanitizeRequestBody(config.data)

    return config
  })

  client.interceptors.response.use(
    (response) => {
      const cfg = response.config as LoggedConfig
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
          const msg = envelope.message || '请求失败'
          const tid = envelope.meta?.traceId || envelope.meta?.requestId
          ElMessage.error({
            message: tid ? `${msg}（trace：${tid}）` : msg,
            duration: tid ? 6500 : 4000,
            showClose: true,
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
    (error) => {
      const status = error.response?.status as number | undefined
      const cfg = error.config as LoggedConfig | undefined
      const raw = error.response?.data
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

      if (status === 401) {
        if (isTokenExchangeRequest(cfg)) {
          // 登录 / 刷 token 本身 401：用户名密码错 或 refresh 失败，提示不登出
          const msg =
            raw && typeof raw === 'object' && 'message' in raw
              ? String((raw as CommonResponse<unknown>).message || '')
              : ''
          showApiErrorToast(msg || '用户名或密码错误')
        } else if (isSessionAuthRequest(cfg)) {
          // /auth/me 401：session 真正失效 → 清 token 跳登录
          localStorage.removeItem('token')
          window.location.href = '/login'
        } else {
          // 业务接口 401：可能是代理鉴权失败 / 该接口 RBAC 不足，不登出
          const msg = extractHttpErrorMessage(error) || '该操作未授权'
          showApiErrorToast(msg, error)
        }
      } else if (status === 403) {
        showApiErrorToast('权限不足', error)
      } else {
        const msg = extractHttpErrorMessage(error)
        if (import.meta.env.DEV && status != null && status >= 500) {
          const cfg = error.config
          const m = (cfg?.method ?? 'get').toUpperCase()
          const path = cfg?.url ? `${cfg.baseURL ?? ''}${cfg.url}` : ''
          console.error('[API]', m, path, status, raw)
        }
        showApiErrorToast(msg, error)
      }
      return Promise.reject(error)
    },
  )
}
