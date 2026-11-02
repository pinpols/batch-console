// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '@/api/client'
import { advanceAuthSession, initializeSharedAuthRevision } from '@/api/authSession'
import { getConfigBatchOperation } from '@/api/configBatchRecovery'
import { fileApi } from '@/api/file'
import { createSseStream } from '@/api/stream'
import { tenantPackageExport } from '@/api/tenantPackageExcel'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { useTenantStore } from '@/stores/tenant'
import {
  createConfigBatchRecovery,
  listConfigBatchRecoveries,
  saveConfigBatchRecovery,
} from '@/utils/configBatchRecovery'
import { readActiveTenantId } from './tenantContext'

class TestEventSource {
  static urls: string[] = []
  onmessage = null
  onerror = null
  constructor(url: string) {
    TestEventSource.urls.push(url)
  }
  addEventListener() {}
  close() {}
}

const previousAdapter = apiClient.defaults.adapter
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  initializeSharedAuthRevision()
  setActivePinia(undefined)
  TestEventSource.urls = []
  vi.stubGlobal('EventSource', TestEventSource)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})
afterEach(() => {
  apiClient.defaults.adapter = previousAdapter
  setActivePinia(undefined)
  vi.unstubAllGlobals()
})

function tabs() {
  const a = createPinia()
  setActivePinia(a)
  const storeA = useTenantStore(a)
  storeA.setTenantId('tenant-a')
  const b = createPinia()
  setActivePinia(b)
  const storeB = useTenantStore(b)
  storeB.setTenantId('tenant-b')
  setActivePinia(a)
  return { a, b, storeA, storeB }
}

describe('标签内租户请求上下文', () => {
  it('新标签初始化前可读取默认值，激活的空租户不回退或沿用旧请求头', async () => {
    localStorage.setItem(STORAGE_KEYS.tenantId, 'default')
    expect(readActiveTenantId()).toBe('default')
    setActivePinia(createPinia())
    const tenant = useTenantStore()
    tenant.setTenantId('')
    localStorage.setItem(STORAGE_KEYS.tenantId, 'other-tab')
    expect(readActiveTenantId()).toBe('')
    let sentTenant: unknown
    apiClient.defaults.adapter = async (config) => {
      sentTenant = config.headers.get('X-Tenant-Id')
      return { config, status: 200, statusText: 'OK', headers: {}, data: {} }
    }
    await apiClient.get('/api/console/empty-tenant-test', { headers: { 'X-Tenant-Id': 'stale' } })
    expect(sentTenant).toBeUndefined()
  })

  it('其他标签切换后，请求头、幂等范围、导出、回查和 SSE 仍属于当前标签', async () => {
    const { b } = tabs()
    const seen: InternalAxiosRequestConfig[] = []
    apiClient.defaults.adapter = async (config) => {
      seen.push(config)
      const data = config.url?.includes('/auth/stream/ticket') ? { ticket: 'ticket-a' } : {}
      return { config, status: 200, statusText: 'OK', headers: {}, data }
    }
    await apiClient.post('/api/console/tenant-context-test', { value: 1 })
    const keyA = seen[0].headers.get('Idempotency-Key')
    await fileApi.detail(1)
    await tenantPackageExport()
    const command = createConfigBatchRecovery({
      actor: 'operator',
      headerTenant: 'tenant-a',
      auditTenantId: 'source',
      operationKind: 'TENANT_COPY',
    })
    expect(saveConfigBatchRecovery(command)).toBe(true)
    await getConfigBatchOperation(command, 'operator', 'tenant-a')
    await createSseStream('workflow-runs', vi.fn())
    expect(seen.every((config) => config.headers.get('X-Tenant-Id') === 'tenant-a')).toBe(true)
    expect(seen.find((config) => config.url?.includes('/queries/files/'))?.params.tenantId).toBe(
      'tenant-a',
    )
    expect(seen.find((config) => config.url?.endsWith('/export'))?.params.tenantId).toBe('tenant-a')
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toContainEqual(command)
    expect(TestEventSource.urls[0]).toContain('tenantId=tenant-a')
    setActivePinia(b)
    await apiClient.post('/api/console/tenant-context-test', { value: 1 })
    expect(seen.at(-1)?.headers.get('X-Tenant-Id')).toBe('tenant-b')
    expect(seen.at(-1)?.headers.get('Idempotency-Key')).not.toBe(keyA)
  })

  it('重试遇到租户 ABA 或认证会话变化时，禁止携带旧幂等键重发', async () => {
    const { storeA } = tabs()
    let original!: InternalAxiosRequestConfig
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      original = config
      return { config, status: 200, statusText: 'OK', headers: {}, data: {} }
    })
    apiClient.defaults.adapter = adapter
    await apiClient.post('/api/console/retry-context-test', {})
    storeA.setTenantId('tenant-b')
    storeA.setTenantId('tenant-a')
    await expect(apiClient.request(original)).rejects.toMatchObject({
      code: 'ERR_TENANT_CONTEXT_CHANGED',
    })
    expect(adapter).toHaveBeenCalledTimes(1)
    await apiClient.post('/api/console/retry-auth-test', {})
    advanceAuthSession()
    await expect(apiClient.request(original)).rejects.toMatchObject({ staleSession: true })
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('换票期间发生租户 ABA 时不创建事件流', async () => {
    const { storeA } = tabs()
    let complete!: (value: unknown) => void
    let started!: () => void
    const pending = new Promise<void>((resolve) => {
      started = resolve
    })
    apiClient.defaults.adapter = async (config) => {
      started()
      await new Promise((resolve) => {
        complete = resolve
      })
      return { config, status: 200, statusText: 'OK', headers: {}, data: { ticket: 'old' } }
    }
    const stream = createSseStream('workflow-runs', vi.fn())
    await pending
    storeA.setTenantId('tenant-b')
    storeA.setTenantId('tenant-a')
    complete(undefined)
    await expect(stream).rejects.toThrow('Tenant context changed')
    expect(TestEventSource.urls).toHaveLength(0)
  })

  it('换票期间认证会话变更时不创建事件流', async () => {
    tabs()
    let complete!: (value: unknown) => void
    let started!: () => void
    const pending = new Promise<void>((resolve) => {
      started = resolve
    })
    apiClient.defaults.adapter = async (config) => {
      started()
      await new Promise((resolve) => {
        complete = resolve
      })
      return { config, status: 200, statusText: 'OK', headers: {}, data: { ticket: 'old' } }
    }
    const stream = createSseStream('workflow-runs', vi.fn())
    await pending
    advanceAuthSession()
    complete(undefined)
    await expect(stream).rejects.toThrow('Tenant context changed')
    expect(TestEventSource.urls).toHaveLength(0)
  })
})
