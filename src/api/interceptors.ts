import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { CommonResponse } from '@/types'
import { createIdempotencyKey } from '@/utils/idempotency'

const TENANT_STORAGE_KEY = 'batch-console-tenant-id'

export function readStoredTenantId(): string {
  return localStorage.getItem(TENANT_STORAGE_KEY) ?? 'default'
}

function isSuccessCode(code: string | number | undefined): boolean {
  if (code === undefined) return true
  if (typeof code === 'number') return code === 0 || code === 200
  return code === 'SUCCESS' || code === '0' || code === '200'
}

function isTokenExchangeRequest(config: InternalAxiosRequestConfig): boolean {
  return Boolean(config.url?.includes('/api/console/auth/token'))
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete'])

export function applyApiInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    if (config.responseType === 'blob') {
      return config
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

    return config
  })

  client.interceptors.response.use(
    (response) => {
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
        if (!isSuccessCode(envelope.code as string | number)) {
          ElMessage.error(envelope.message || '请求失败')
          return Promise.reject(new Error(envelope.message))
        }
        response.data = envelope.data
      }

      return response
    },
    (error) => {
      const status = error.response?.status as number | undefined
      if (status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      } else if (status === 403) {
        ElMessage.error('权限不足')
      } else {
        const msg =
          error.response?.data?.message ??
          (typeof error.response?.data === 'string' ? error.response.data : null) ??
          '网络异常'
        ElMessage.error(msg)
      }
      return Promise.reject(error)
    },
  )
}
