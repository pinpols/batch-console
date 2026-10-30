import { describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
import { useTenantRequestScope } from './useTenantRequestScope'
const state = vi.hoisted(() => ({ tenant: null as unknown as { tenantId: string } }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))

describe('租户请求生命周期', () => {
  function setup() {
    state.tenant = reactive({ tenantId: 'tenant-a' })
    const owner = effectScope()
    const requests = owner.run(() => useTenantRequestScope())!
    return { owner, requests }
  }

  it('同租户后发请求使旧结果失效', () => {
    const { owner, requests } = setup()
    const first = requests.begin()
    const second = requests.begin()
    expect(requests.isCurrent(first)).toBe(false)
    expect(requests.isCurrent(second)).toBe(true)
    owner.stop()
  })

  it('同步经历 A 到 B 再回 A 后也不接受原请求', () => {
    const { owner, requests } = setup()
    const first = requests.begin()
    state.tenant.tenantId = 'tenant-b'
    state.tenant.tenantId = 'tenant-a'
    expect(requests.isCurrent(first)).toBe(false)
    owner.stop()
  })

  it('组件作用域结束后丢弃结果', () => {
    const { owner, requests } = setup()
    const request = requests.begin()
    owner.stop()
    expect(requests.isCurrent(request)).toBe(false)
  })

  it('空租户不能成为有效请求目标', () => {
    const { owner, requests } = setup()
    state.tenant.tenantId = ''
    expect(requests.isCurrent(requests.begin())).toBe(false)
    owner.stop()
  })
})
