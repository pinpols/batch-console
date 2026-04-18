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

  it('defaults to "default-tenant" when localStorage is empty', () => {
    const tenant = useTenantStore()
    expect(tenant.tenantId).toBe('default-tenant')
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

  it('setTenantId falls back to default-tenant for empty string', () => {
    const tenant = useTenantStore()
    tenant.setTenantId('')
    expect(tenant.tenantId).toBe('default-tenant')
  })
})
