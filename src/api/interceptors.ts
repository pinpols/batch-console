import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { CommonResponse } from '@/types'
import { createIdempotencyKey } from '@/utils/idempotency'
import { setLastApiMeta } from '@/utils/lastApiMeta'
import { logApi } from '@/utils/logger'
import { trackApi, trackApiError } from '@/utils/telemetry'

const TENANT_STORAGE_KEY = 'batch-console-tenant-id'

export function readStoredTenantId(): string {
  return localStorage.getItem(TENANT_STORAGE_KEY) ?? 'default-tenant'
}

function isSuccessCode(code: string | number | undefined): boolean {
  if (code === undefined) return true
  if (typeof code === 'number') return code === 0 || code === 200
  return code === 'SUCCESS' || code === '0' || code === '200'
}

function isTokenExchangeRequest(config: InternalAxiosRequestConfig): boolean {
  const u = config.url ?? ''
  return u.includes('/api/console/auth/login') || u.includes('/api/console/auth/token')
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

    // 记录请求发起时间供耗时计算
    ;(config as InternalAxiosRequestConfig & { _startTime?: number })._startTime = Date.now()

    return config
  })

  client.interceptors.response.use(
    (response) => {
      const cfg = response.config as InternalAxiosRequestConfig & { _startTime?: number }
      const duration = cfg._startTime ? Date.now() - cfg._startTime : undefined
      const method = (cfg.method ?? 'get').toUpperCase()
      const url = cfg.url ?? ''
      logApi(`${method} ${url} → ${response.status}`, 'info', {
        method,
        url,
        status: response.status,
        ...(duration != null ? { durationMs: duration } : {}),
      })
      trackApi(`${method} ${url}`, {
        status: response.status,
        ...(duration != null ? { durationMs: duration } : {}),
      })

      if (response.config.responseType === 'blob') {
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
      const cfg = error.config as (InternalAxiosRequestConfig & { _startTime?: number }) | undefined
      const raw = error.response?.data
      {
        const duration = cfg?._startTime ? Date.now() - cfg._startTime : undefined
        const method = (cfg?.method ?? 'get').toUpperCase()
        const url = cfg?.url ?? ''
        logApi(`${method} ${url} → ${status ?? 'ERR'}`, 'error', {
          method,
          url,
          status,
          error: extractHttpErrorMessage(error),
          ...(duration != null ? { durationMs: duration } : {}),
        })
        trackApiError(`${method} ${url}`, {
          status,
          error: extractHttpErrorMessage(error),
          ...(duration != null ? { durationMs: duration } : {}),
        })
      }
      if (raw && typeof raw === 'object' && 'meta' in raw) {
        setLastApiMeta((raw as CommonResponse<unknown>).meta ?? null)
      }

      if (status === 401) {
        if (!isTokenExchangeRequest(cfg)) {
          localStorage.removeItem('token')
          window.location.href = '/login'
        } else {
          const msg =
            raw && typeof raw === 'object' && 'message' in raw
              ? String((raw as CommonResponse<unknown>).message || '')
              : ''
          showApiErrorToast(msg || '用户名或密码错误')
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
