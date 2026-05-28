import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTenantStore } from './tenant'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})

describe('useTenantStore', () => {
  beforeEach(() => {
    storage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to empty when localStorage is empty (no implicit default-tenant)', () => {
    const tenant = useTenantStore()
    // 安全收敛:未登录/未选租户时 tenantId 必须为空,不再静默落到 'default-tenant'
    // 伪装合法请求 → 由 BE 拒绝。详见 PR #25。
    expect(tenant.tenantId).toBe('')
  })

  it('reads initial value from localStorage', () => {
    storage.set('batch-console-tenant-id', 'my-tenant')
    setActivePinia(createPinia())
    const tenant = useTenantStore()
    expect(tenant.tenantId).toBe('my-tenant')
  })

  it('setTenantId updates the value', () => {
    const tenant = useTenantStore()
    tenant.setTenantId('new-tenant')
    expect(tenant.tenantId).toBe('new-tenant')
  })

  it('setTenantId clears to empty for empty / whitespace-only input (no default-tenant fallback)', () => {
    storage.set('batch-console-tenant-id', 'pre-existing-tenant')
    setActivePinia(createPinia())
    const tenant = useTenantStore()
    tenant.setTenantId('  ')
    // trim 后空字符串 → 清空 + 从 localStorage removeItem(不回写,不伪装)
    expect(tenant.tenantId).toBe('')
  })
})
