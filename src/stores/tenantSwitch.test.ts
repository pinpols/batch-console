import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { advanceAuthSession } from '@/api/authSession'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { stubLocalStorage } from '@/test-utils/localStorage'
import { useTenantStore } from './tenant'

const storage = stubLocalStorage()

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
})

describe('交互式租户切换', () => {
  it('无草稿时直接切换；同一租户不确认也不重复切换', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const confirm = vi.fn(async () => true)
    expect(await tenant.requestTenantSwitch('tenant-a', confirm)).toBe(false)
    expect(await tenant.requestTenantSwitch(undefined as unknown as string, confirm)).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(tenant.tenantId).toBe('tenant-b')
    expect(storage.get(STORAGE_KEYS.tenantId)).toBe('tenant-b')
  })

  it('有草稿时取消保留原租户及持久化值；确认后切换', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    tenant.registerTenantChangeGuard(() => true)
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(false)
    expect(tenant.tenantId).toBe('tenant-a')
    expect(storage.get(STORAGE_KEYS.tenantId)).toBe('tenant-a')
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(tenant.tenantId).toBe('tenant-b')
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('多个草稿只确认一次，注销后不再拦截', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const stopA = tenant.registerTenantChangeGuard(() => true)
    const stopB = tenant.registerTenantChangeGuard(() => true)
    const confirm = vi.fn(async () => true)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
    stopA()
    stopB()
    expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('持久化失败时不更新当前标签的租户', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('storage unavailable')
    })
    expect(await tenant.requestTenantSwitch('tenant-b', async () => true)).toBe(false)
    expect(tenant.tenantId).toBe('tenant-a')
    expect(storage.get(STORAGE_KEYS.tenantId)).toBe('tenant-a')
    setItem.mockRestore()
  })

  it('确认期间拒绝第二次切换，旧租户发生变化后不应用确认结果', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    tenant.registerTenantChangeGuard(() => true)
    let finish!: (value: boolean) => void
    const confirm = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    const first = tenant.requestTenantSwitch('tenant-b', confirm)
    expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(false)
    tenant.setTenantId('tenant-other')
    tenant.setTenantId('tenant-a')
    finish(true)
    expect(await first).toBe(false)
    expect(tenant.tenantId).toBe('tenant-a')
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('确认期间认证会话或守卫拥有者改变时不应用确认结果', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const stop = tenant.registerTenantChangeGuard(() => true)
    let finish!: (value: boolean) => void
    const confirm = () =>
      new Promise<boolean>((resolve) => {
        finish = resolve
      })
    const first = tenant.requestTenantSwitch('tenant-b', confirm)
    advanceAuthSession()
    finish(true)
    expect(await first).toBe(false)
    const second = tenant.requestTenantSwitch('tenant-c', confirm)
    stop()
    finish(true)
    expect(await second).toBe(false)
    expect(tenant.tenantId).toBe('tenant-a')
  })
})
