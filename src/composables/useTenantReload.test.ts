import { describe, it, expect, beforeEach, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useTenantStore } from '@/stores/tenant'
import { useTenantReload } from './useTenantReload'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})

function runInScope(fn: () => void) {
  const scope = effectScope()
  scope.run(fn)
  return scope
}

describe('useTenantReload', () => {
  beforeEach(() => {
    storage.clear()
    setActivePinia(createPinia())
  })

  it('invokes fn immediately at setup time when a tenant is already selected', () => {
    const fn = vi.fn()
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const scope = runInScope(() => useTenantReload(fn))
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('does NOT invoke fn at setup when no tenant is selected (empty tenantId)', async () => {
    // admin 登录后尚未选租户:空 tenantId 不触发加载,避免页面用空 tenantId 发请求被 BE 拒为 400
    const fn = vi.fn()
    const scope = runInScope(() => useTenantReload(fn))
    await nextTick()
    expect(fn).not.toHaveBeenCalled()
    scope.stop()
  })

  it('invokes fn once a tenant becomes selected, then again on each change', async () => {
    const fn = vi.fn()
    const scope = runInScope(() => useTenantReload(fn))
    const tenant = useTenantStore()
    expect(fn).not.toHaveBeenCalled() // 起始空 tenantId,不触发
    tenant.setTenantId('tenant-b')
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    tenant.setTenantId('tenant-c')
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('does not re-invoke when tenantId is set to the same value', async () => {
    const fn = vi.fn()
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const scope = runInScope(() => useTenantReload(fn))
    expect(fn).toHaveBeenCalledTimes(1)
    tenant.setTenantId('tenant-a')
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('stops reloading after scope is disposed', async () => {
    const fn = vi.fn()
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const scope = runInScope(() => useTenantReload(fn))
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
    tenant.setTenantId('tenant-d')
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not throw when fn returns a rejected promise', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom')
    })
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const scope = runInScope(() => useTenantReload(fn))
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})
